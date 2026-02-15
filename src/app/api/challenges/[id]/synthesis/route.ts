/**
 * AI Synthesis API — Generate neutral description from both perspectives
 *
 * POST /api/challenges/[id]/synthesis — Generate (or regenerate with feedback)
 *
 * Streams the AI response via SSE.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  challenges,
  challengePerspectives,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import { CHALLENGE_UPDATED } from "@/lib/socket/events";
import { SYNTHESIS_PROMPT, buildSystemPrompt } from "@/lib/ai/prompts";
import { loadCoupleContext } from "@/lib/ai/context";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify access
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, id));
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, challenge.coupleId),
        eq(coupleMembers.userId, session.user.id)
      )
    );
  if (!member) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Both perspectives must be submitted
  const perspectives = await db
    .select({
      userId: challengePerspectives.userId,
      perspectiveText: challengePerspectives.perspectiveText,
      submitted: challengePerspectives.submitted,
      userName: user.name,
    })
    .from(challengePerspectives)
    .leftJoin(user, eq(user.id, challengePerspectives.userId))
    .where(eq(challengePerspectives.challengeId, id))
    .orderBy(asc(challengePerspectives.createdAt));

  if (!perspectives.every((p) => p.submitted)) {
    return NextResponse.json(
      { error: "Both perspectives must be submitted before generating synthesis" },
      { status: 400 }
    );
  }

  // Check for refinement feedback (when partner rejected and explained why)
  const body = await request.json().catch(() => ({}));
  const refinementFeedback = body.refinementFeedback || challenge.rejectionFeedback || null;

  // Build the prompt
  const partnerA = perspectives[0];
  const partnerB = perspectives[1];

  let userMessage = `## Challenge: ${challenge.title}
## Category: ${challenge.category}

### ${partnerA?.userName || "Partner A"}'s Perspective:
${partnerA?.perspectiveText || "Not provided"}

### ${partnerB?.userName || "Partner B"}'s Perspective:
${partnerB?.perspectiveText || "Not provided"}`;

  if (refinementFeedback) {
    userMessage += `\n\n### Feedback on Previous Synthesis:
The following feedback was provided by a partner who felt the previous synthesis didn't accurately capture their experience. Please regenerate the synthesis incorporating this feedback:

${refinementFeedback}`;

    if (challenge.aiNeutralDescription) {
      userMessage += `\n\n### Previous Synthesis (to improve upon):
${challenge.aiNeutralDescription}`;
    }
  }

  const ctx = await loadCoupleContext(challenge.coupleId);
  const systemPrompt = buildSystemPrompt({
    basePrompt: SYNTHESIS_PROMPT,
    ...ctx,
  });

  // Stream the AI response
  const stream = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
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

        // Save synthesis to DB and advance status
        await db
          .update(challenges)
          .set({
            aiNeutralDescription: fullResponse,
            status: "synthesis",
            // Reset acceptance flags for new synthesis
            acceptedByA: false,
            acceptedByB: false,
            rejectionFeedback: null,
          })
          .where(eq(challenges.id, id));

        // Emit real-time event to partner
        try {
          const { getIO } = await import("@/lib/socket/socketServer");
          getIO().to(`couple:${challenge.coupleId}`).emit(CHALLENGE_UPDATED, {
            challengeId: id,
            action: "synthesis-generated",
            userId: session.user.id,
          });
        } catch { /* socket not available in test */ }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Synthesis streaming error:", error);
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
