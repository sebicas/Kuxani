/**
 * Personal Chat Messages API — Send message + stream AI response
 *
 * POST /api/personal/chats/[id]/messages
 *
 * Saves the user's message, then streams back the AI therapist response
 * using OpenAI's gpt-4.1 with the PERSONAL_THERAPY_PROMPT.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { personalChats, personalMessages, user } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import { PERSONAL_THERAPY_PROMPT, buildSystemPrompt } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { content } = body;

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

  // Get user's personal profile data for context
  const [userData] = await db
    .select({ profileData: user.profileData })
    .from(user)
    .where(eq(user.id, session.user.id));

  // Build system prompt with personal profile context
  const systemPrompt = buildSystemPrompt({
    basePrompt: PERSONAL_THERAPY_PROMPT,
    personalProfile: userData?.profileData
      ? JSON.stringify(userData.profileData, null, 2)
      : undefined,
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

        // Save AI response to DB
        await db.insert(personalMessages).values({
          chatId: id,
          role: "assistant",
          content: fullResponse,
        });

        // Auto-title the chat if it's still "New Chat" and this is the first exchange
        if (chat.title === "New Chat" && history.length <= 1) {
          // Generate a short title from the user's message
          const titleContent = content.slice(0, 60);
          const title = titleContent.length < content.length
            ? titleContent + "…"
            : titleContent;

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
