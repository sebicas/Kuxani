/**
 * Resolve Challenge API
 *
 * POST /api/challenges/[id]/resolve — Mark challenge as resolved
 *
 * Requires resolution notes. Generates a challenge summary for AI memory (Tier 2).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  challenges,
  challengePerspectives,
  challengeRequests,
  challengeSummaries,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { openai, LIGHT_MODEL } from "@/lib/ai/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { resolutionNotes } = body;

  if (!resolutionNotes || typeof resolutionNotes !== "string" || resolutionNotes.trim().length === 0) {
    return NextResponse.json(
      { error: "Resolution notes are required. What did you learn from this challenge?" },
      { status: 400 }
    );
  }

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

  // Mark as resolved
  const [resolved] = await db
    .update(challenges)
    .set({
      status: "resolved",
      resolutionNotes: resolutionNotes.trim(),
      resolvedAt: new Date(),
    })
    .where(eq(challenges.id, id))
    .returning();

  // Generate challenge summary for AI memory (Tier 2) in background
  try {
    const perspectives = await db
      .select({ perspectiveText: challengePerspectives.perspectiveText, userName: user.name })
      .from(challengePerspectives)
      .leftJoin(user, eq(user.id, challengePerspectives.userId))
      .where(eq(challengePerspectives.challengeId, id))
      .orderBy(asc(challengePerspectives.createdAt));

    const requests = await db
      .select()
      .from(challengeRequests)
      .where(eq(challengeRequests.challengeId, id));

    const summaryPrompt = `Summarize this resolved relationship challenge for future reference.

Challenge: "${challenge.title}" (${challenge.category})

Perspectives:
${perspectives.map((p, i) => `${p.userName || `Partner ${i + 1}`}: ${p.perspectiveText}`).join("\n\n")}

Synthesis: ${challenge.aiNeutralDescription || "N/A"}

Commitments: ${requests.map((r) => `- ${r.requestText} (${r.category}, ${r.acceptedByPartner ? "accepted" : "pending"})`).join("\n")}

Resolution notes: ${resolutionNotes}

Provide a JSON object with:
- topic: string (one-line summary)
- recurringThemes: string[] (themes/patterns)
- growthAreas: string[] (areas for continued growth)
- resolutionApproach: string (how they resolved it)`;

    const completion = await openai.chat.completions.create({
      model: LIGHT_MODEL,
      messages: [
        { role: "system", content: "You are a relationship analyst. Respond only with valid JSON." },
        { role: "user", content: summaryPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const summaryData = JSON.parse(completion.choices[0]?.message?.content || "{}");

    await db.insert(challengeSummaries).values({
      challengeId: id,
      topic: summaryData.topic || challenge.title,
      recurringThemes: summaryData.recurringThemes || [],
      growthAreas: summaryData.growthAreas || [],
      resolutionApproach: summaryData.resolutionApproach || resolutionNotes,
      commitmentsMade: requests.map((r) => ({
        text: r.requestText,
        category: r.category,
        accepted: r.acceptedByPartner,
        fulfilled: r.fulfilled,
      })),
    });
  } catch (err) {
    // Non-critical — don't fail the resolution
    console.error("Failed to generate challenge summary:", err);
  }

  return NextResponse.json(resolved);
}
