/**
 * Discussion Messages API — Chat with partner + AI guidance
 *
 * GET  /api/challenges/[id]/messages — List discussion messages
 * POST /api/challenges/[id]/messages — Send a message, get AI response (SSE)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  challenges,
  challengeMessages,
  challengePerspectives,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import { DISCUSSION_PROMPT, buildSystemPrompt } from "@/lib/ai/prompts";

type Params = { params: Promise<{ id: string }> };

async function verifyAccess(challengeId: string, userId: string) {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId));

  if (!challenge) return null;

  const [member] = await db
    .select()
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, challenge.coupleId),
        eq(coupleMembers.userId, userId)
      )
    );

  if (!member) return null;
  return challenge;
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const challenge = await verifyAccess(id, session.user.id);
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const messages = await db
    .select({
      id: challengeMessages.id,
      senderId: challengeMessages.senderId,
      senderType: challengeMessages.senderType,
      content: challengeMessages.content,
      pinned: challengeMessages.pinned,
      createdAt: challengeMessages.createdAt,
      senderName: user.name,
    })
    .from(challengeMessages)
    .leftJoin(user, eq(user.id, challengeMessages.senderId))
    .where(eq(challengeMessages.challengeId, id))
    .orderBy(asc(challengeMessages.createdAt));

  return NextResponse.json(messages);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const challenge = await verifyAccess(id, session.user.id);
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  // Save user message
  await db.insert(challengeMessages).values({
    challengeId: id,
    senderId: session.user.id,
    senderType: "user",
    content: content.trim(),
  });

  // Build discussion context
  const perspectives = await db
    .select({
      perspectiveText: challengePerspectives.perspectiveText,
      userName: user.name,
    })
    .from(challengePerspectives)
    .leftJoin(user, eq(user.id, challengePerspectives.userId))
    .where(eq(challengePerspectives.challengeId, id))
    .orderBy(asc(challengePerspectives.createdAt));

  const history = await db
    .select({
      senderType: challengeMessages.senderType,
      content: challengeMessages.content,
      senderName: user.name,
    })
    .from(challengeMessages)
    .leftJoin(user, eq(user.id, challengeMessages.senderId))
    .where(eq(challengeMessages.challengeId, id))
    .orderBy(asc(challengeMessages.createdAt));

  // Build context for the AI
  let contextMessage = `## Challenge: "${challenge.title}" (${challenge.category})

### Partner Perspectives:
${perspectives.map((p, i) => `**${p.userName || `Partner ${i + 1}`}:** ${p.perspectiveText || "Not provided"}`).join("\n\n")}

### Accepted Neutral Synthesis:
${challenge.aiNeutralDescription || "Not yet generated"}

### Discussion so far:`;

  const systemPrompt = buildSystemPrompt({
    basePrompt: DISCUSSION_PROMPT,
  });

  // Build OpenAI messages
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextMessage },
  ];

  // Add discussion history
  for (const msg of history) {
    if (msg.senderType === "ai") {
      messages.push({ role: "assistant", content: msg.content });
    } else {
      messages.push({
        role: "user",
        content: `[${msg.senderName || "Partner"}]: ${msg.content}`,
      });
    }
  }

  // Stream AI response
  const stream = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages,
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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Save AI response
        await db.insert(challengeMessages).values({
          challengeId: id,
          senderId: null,
          senderType: "ai",
          content: fullResponse,
        });

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Discussion streaming error:", error);
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
