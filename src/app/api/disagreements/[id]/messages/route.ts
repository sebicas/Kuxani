/**
 * Disagreement Messages API — Chat with AI therapist
 *
 * GET  /api/disagreements/[id]/messages — List messages
 * POST /api/disagreements/[id]/messages — Send message + get AI response (SSE)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  disagreements,
  disagreementMessages,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import {
  DISAGREEMENT_INTAKE_PROMPT,
  DISAGREEMENT_CLARIFY_PROMPT,
  DISAGREEMENT_CONFIRM_PROMPT,
  DISAGREEMENT_RESOLUTION_PROMPT,
  buildSystemPrompt,
} from "@/lib/ai/prompts";
import { loadCoupleContext, loadPersonalContext } from "@/lib/ai/context";
import { DISAGREEMENT_MESSAGE, DISAGREEMENT_STATUS } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Pick the right AI prompt based on the disagreement status */
function getPromptForStatus(status: string): string {
  switch (status) {
    case "intake":
      return DISAGREEMENT_INTAKE_PROMPT;
    case "clarifying":
      return DISAGREEMENT_CLARIFY_PROMPT;
    case "confirmed":
    case "invite_sent":
      return DISAGREEMENT_CONFIRM_PROMPT;
    case "partner_joined":
    case "active":
    case "resolving":
      return DISAGREEMENT_RESOLUTION_PROMPT;
    default:
      return DISAGREEMENT_INTAKE_PROMPT;
  }
}

async function verifyAccess(disagreementId: string, userId: string) {
  const [d] = await db
    .select()
    .from(disagreements)
    .where(eq(disagreements.id, disagreementId));

  if (!d) return null;

  // Creator always has access
  if (d.userId === userId) return d;

  // Partner has access if shared + same couple
  if (d.coupleId && d.visibility === "shared") {
    const [member] = await db
      .select()
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, d.coupleId),
          eq(coupleMembers.userId, userId)
        )
      );
    if (member) return d;
  }

  return null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const disagreement = await verifyAccess(id, session.user.id);
  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Determine which messages the user can see
  const isCreator = disagreement.userId === session.user.id;
  const visibleFilter = isCreator ? "partner_only" : "creator_only";

  const messages = await db
    .select({
      id: disagreementMessages.id,
      senderId: disagreementMessages.senderId,
      senderType: disagreementMessages.senderType,
      content: disagreementMessages.content,
      metadata: disagreementMessages.metadata,
      visibleTo: disagreementMessages.visibleTo,
      createdAt: disagreementMessages.createdAt,
      senderName: user.name,
    })
    .from(disagreementMessages)
    .leftJoin(user, eq(user.id, disagreementMessages.senderId))
    .where(eq(disagreementMessages.disagreementId, id))
    .orderBy(asc(disagreementMessages.createdAt));

  // Filter out messages not meant for this user
  const filteredMessages = messages.filter(
    (m) => m.visibleTo === "all" || m.visibleTo !== visibleFilter
  );

  return NextResponse.json(filteredMessages);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const disagreement = await verifyAccess(id, session.user.id);
  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (disagreement.status === "resolved") {
    return NextResponse.json(
      { error: "This disagreement is resolved" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Message content required" },
      { status: 400 }
    );
  }

  const isCreator = disagreement.userId === session.user.id;
  const isShared = disagreement.visibility === "shared";

  // Save user message
  await db.insert(disagreementMessages).values({
    disagreementId: id,
    senderId: session.user.id,
    senderType: "user",
    content: content.trim(),
    visibleTo: isShared ? "all" : isCreator ? "creator_only" : "all",
  });

  // Auto-transition: intake → clarifying on first user message
  let newStatus = disagreement.status;
  if (disagreement.status === "intake") {
    newStatus = "clarifying";
    await db
      .update(disagreements)
      .set({ status: "clarifying" })
      .where(eq(disagreements.id, id));
  }

  // Build AI context
  const prompt = getPromptForStatus(newStatus);
  const ctx = disagreement.coupleId
    ? await loadCoupleContext(disagreement.coupleId)
    : await loadPersonalContext(session.user.id);

  const systemPrompt = buildSystemPrompt({
    basePrompt: prompt,
    ...ctx,
  });

  // Build context about the disagreement
  const contextMessage = `## Disagreement: "${disagreement.title}" (${disagreement.category})
Status: ${newStatus}
${disagreement.creatorPerspective ? `Creator's perspective: ${disagreement.creatorPerspective}` : ""}
${disagreement.partnerPerspective ? `Partner's perspective: ${disagreement.partnerPerspective}` : ""}

### Conversation so far:`;

  // Get message history
  const history = await db
    .select({
      senderType: disagreementMessages.senderType,
      content: disagreementMessages.content,
      senderName: user.name,
    })
    .from(disagreementMessages)
    .leftJoin(user, eq(user.id, disagreementMessages.senderId))
    .where(eq(disagreementMessages.disagreementId, id))
    .orderBy(asc(disagreementMessages.createdAt));

  const aiMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextMessage },
  ];

  for (const msg of history) {
    if (msg.senderType === "ai") {
      aiMessages.push({ role: "assistant", content: msg.content });
    } else if (msg.senderType === "user") {
      aiMessages.push({
        role: "user",
        content: `[${msg.senderName || "User"}]: ${msg.content}`,
      });
    }
  }

  // Stream AI response
  const stream = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages: aiMessages,
    stream: true,
  });

  let fullResponse = "";
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Save AI response
        await db.insert(disagreementMessages).values({
          disagreementId: id,
          senderId: null,
          senderType: "ai",
          content: fullResponse,
          visibleTo: isShared ? "all" : isCreator ? "creator_only" : "all",
        });

        // Emit real-time events
        try {
          const { getIO } = await import("@/lib/socket/socketServer");
          const io = getIO();

          // Notify the disagreement room
          io.to(`disagreement:${id}`).emit(DISAGREEMENT_MESSAGE, {
            disagreementId: id,
            userId: session.user.id,
          });

          // If status changed, emit status event
          if (newStatus !== disagreement.status && disagreement.coupleId) {
            io.to(`couple:${disagreement.coupleId}`).emit(
              DISAGREEMENT_STATUS,
              {
                disagreementId: id,
                status: newStatus,
                action: "status-changed",
                userId: session.user.id,
              }
            );
          }
        } catch {
          /* socket not available in test */
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Disagreement streaming error:", error);
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
