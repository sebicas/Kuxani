/**
 * Love Languages API — Get Results & Save Results
 *
 * GET  /api/love-languages — Get user's results (+ partner's if available)
 * POST /api/love-languages — Save quiz results
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loveLanguageResults, coupleMembers } from "@/lib/db/schema";
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
    .from(loveLanguageResults)
    .where(eq(loveLanguageResults.userId, session.user.id))
    .orderBy(desc(loveLanguageResults.createdAt))
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
        .from(loveLanguageResults)
        .where(eq(loveLanguageResults.userId, partner.userId))
        .orderBy(desc(loveLanguageResults.createdAt))
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
  const { wordsOfAffirmation, actsOfService, receivingGifts, qualityTime, physicalTouch } = body;

  // Validate all scores are present and reasonable
  const scores = [wordsOfAffirmation, actsOfService, receivingGifts, qualityTime, physicalTouch];
  if (scores.some((s) => typeof s !== "number" || s < 0 || s > 30)) {
    return NextResponse.json(
      { error: "Invalid scores. Each must be a number 0-30." },
      { status: 400 }
    );
  }

  const [result] = await db
    .insert(loveLanguageResults)
    .values({
      userId: session.user.id,
      wordsOfAffirmation,
      actsOfService,
      receivingGifts,
      qualityTime,
      physicalTouch,
    })
    .returning();

  return NextResponse.json(result, { status: 201 });
}
