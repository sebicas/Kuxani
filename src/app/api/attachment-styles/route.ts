/**
 * Attachment Styles API — Get Results & Save Results
 *
 * GET  /api/attachment-styles — Get user's results (+ partner's if available)
 * POST /api/attachment-styles — Save quiz results + emit real-time event
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attachmentStyleResults, coupleMembers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, and, ne } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's latest result
  const [userResult] = await db
    .select()
    .from(attachmentStyleResults)
    .where(eq(attachmentStyleResults.userId, session.user.id))
    .orderBy(desc(attachmentStyleResults.createdAt))
    .limit(1);

  // Try to get partner's result
  let partnerResult = null;
  const userMemberships = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, session.user.id));

  if (userMemberships.length > 0) {
    const coupleId = userMemberships[0].coupleId;
    // Find partner in the same couple
    const [partner] = await db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, coupleId),
          ne(coupleMembers.userId, session.user.id)
        )
      );

    if (partner) {
      const [result] = await db
        .select()
        .from(attachmentStyleResults)
        .where(eq(attachmentStyleResults.userId, partner.userId))
        .orderBy(desc(attachmentStyleResults.createdAt))
        .limit(1);

      partnerResult = result || null;
    }
  }

  return NextResponse.json({
    userResult: userResult || null,
    partnerResult,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { secure, anxious, avoidant, fearfulAvoidant } = body;

  // Validate all scores are present and in range (5 questions × 1–5 rating = 5–25)
  const scores = [secure, anxious, avoidant, fearfulAvoidant];
  if (scores.some((s) => typeof s !== "number" || s < 5 || s > 25)) {
    return NextResponse.json(
      { error: "Invalid scores. Each must be a number 5-25." },
      { status: 400 }
    );
  }

  const [result] = await db
    .insert(attachmentStyleResults)
    .values({
      userId: session.user.id,
      secure,
      anxious,
      avoidant,
      fearfulAvoidant,
    })
    .returning();

  // Emit real-time event to partner
  const userMembership = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, session.user.id))
    .limit(1);

  if (userMembership.length > 0) {
    try {
      const { getIO } = await import("@/lib/socket/socketServer");
      const { ATTACHMENT_STYLE_UPDATED } = await import("@/lib/socket/events");
      getIO()
        .to(`couple:${userMembership[0].coupleId}`)
        .emit(ATTACHMENT_STYLE_UPDATED, {
          resultId: result.id,
          action: "attachment-style-completed",
          userId: session.user.id,
        });
    } catch {
      /* socket not available in test */
    }
  }

  return NextResponse.json(result, { status: 201 });
}
