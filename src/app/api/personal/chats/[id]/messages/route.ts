/**
 * Personal Chat Messages API
 *
 * POST /api/personal/chats/[id]/messages — Send message + stream AI response
 * PUT  /api/personal/chats/[id]/messages — Save voice transcript messages
 *
 * POST /api/personal/chats/[id]/messages
 *
 * Saves the user's message, then streams back the AI therapist response
 * using OpenAI's gpt-4.1 with the PERSONAL_THERAPY_PROMPT.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { personalChats, personalMessages } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import { PERSONAL_THERAPY_PROMPT, INTAKE_INTERVIEW_PROMPT, buildSystemPrompt } from "@/lib/ai/prompts";
import { loadPersonalContext } from "@/lib/ai/context";

const INTAKE_TRIGGER = "Hi, I'm ready to continue with my intake interview.";

/** Strip intake_data blocks from text */
function stripIntakeData(text: string): string {
  return text.replace(/```intake_data\s*\n[\s\S]*?```/g, "").trim();
}

/** Parse intake_data blocks from AI response */
function parseIntakeData(text: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  const regex = /```intake_data\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch { /* skip malformed JSON */ }
  }
  return blocks;
}

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let content: string;
  try {
    const body = await request.json();
    content = body.content;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  // Verify chat ownership
  const [chat] = await db
    .select()
    .from(personalChats)
    .where(
      and(eq(personalChats.id, id), eq(personalChats.userId, session.user.id))
    );

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Save user message
  await db.insert(personalMessages).values({
    chatId: id,
    role: "user",
    content,
  });

  // Get conversation history for context
  const history = await db
    .select()
    .from(personalMessages)
    .where(eq(personalMessages.chatId, id))
    .orderBy(asc(personalMessages.createdAt));

  // Load full personal context from all data sources
  const ctx = await loadPersonalContext(session.user.id);

  // Determine if this is an intake chat session
  // (first message in the conversation is the intake trigger)
  const isIntakeChat =
    history.length > 0 && history[0].content.trim() === INTAKE_TRIGGER;

  // Build system prompt with enriched context
  const basePrompt = isIntakeChat ? INTAKE_INTERVIEW_PROMPT : PERSONAL_THERAPY_PROMPT;
  const systemPrompt = buildSystemPrompt({
    basePrompt,
    ...ctx,
  });

  // Build messages for OpenAI
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  // Stream AI response
  const stream = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages,
    stream: true,
  });

  // Collect full response for saving to DB
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

        // For intake chats, parse and save extracted data, then strip blocks
        if (isIntakeChat) {
          const intakeBlocks = parseIntakeData(fullResponse);
          if (intakeBlocks.length > 0) {
            // Dynamically import the intake data saver to avoid circular deps
            const { saveIntakeDataFromChat } = await import("@/lib/ai/intake-data-saver");
            for (const block of intakeBlocks) {
              await saveIntakeDataFromChat(session.user.id, block);
            }
          }
        }

        // Save AI response to DB (strip intake_data blocks from visible content)
        const cleanedResponse = isIntakeChat ? stripIntakeData(fullResponse) : fullResponse;
        await db.insert(personalMessages).values({
          chatId: id,
          role: "assistant",
          content: cleanedResponse,
        });

        // Auto-title the chat if it's still "New Chat" and this is the first exchange
        if (chat.title === "New Chat" && history.length <= 1) {
          const title = isIntakeChat
            ? "Intake Interview"
            : content.length > 60
              ? content.slice(0, 60) + "…"
              : content;

          await db
            .update(personalChats)
            .set({ title })
            .where(eq(personalChats.id, id));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
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

/**
 * PUT /api/personal/chats/[id]/messages — Save voice transcript messages
 *
 * Receives an array of { role, content } pairs from a voice session
 * and inserts them into the database.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { messages: transcriptMessages } = body;

  if (!Array.isArray(transcriptMessages) || transcriptMessages.length === 0) {
    return NextResponse.json({ error: "Messages array required" }, { status: 400 });
  }

  // Verify chat ownership
  const [chat] = await db
    .select()
    .from(personalChats)
    .where(
      and(eq(personalChats.id, id), eq(personalChats.userId, session.user.id))
    );

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Validate and insert messages
  const validMessages = transcriptMessages.filter(
    (m: { role?: string; content?: string }) =>
      m.role && (m.role === "user" || m.role === "assistant") && m.content?.trim()
  );

  if (validMessages.length === 0) {
    return NextResponse.json({ error: "No valid messages" }, { status: 400 });
  }

  await db.insert(personalMessages).values(
    validMessages.map((m: { role: "user" | "assistant"; content: string }) => ({
      chatId: id,
      role: m.role,
      content: m.content.trim(),
    }))
  );

  return NextResponse.json({ saved: validMessages.length });
}
