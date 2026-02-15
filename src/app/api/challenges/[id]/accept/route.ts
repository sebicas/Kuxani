/**
 * Accept / Reject Synthesis API
 *
 * POST /api/challenges/[id]/accept — Accept or reject the AI synthesis
 *
 * Body: { accept: boolean, rejectionReason?: string }
 *
 * If a partner rejects, they must explain why. The rejection feedback is saved
 * and the synthesis must be regenerated before they can try accepting again.
 * If both accept, advances to "discussion" status.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { challenges, coupleMembers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { accept, rejectionReason } = body;

  if (typeof accept !== "boolean") {
    return NextResponse.json({ error: "accept must be a boolean" }, { status: 400 });
  }

  // Verify access & get challenge
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

  if (!challenge.aiNeutralDescription) {
    return NextResponse.json(
      { error: "No synthesis to accept/reject. Generate one first." },
      { status: 400 }
    );
  }

  // Determine partner label (A or B)
  const members = await db
    .select({ userId: coupleMembers.userId })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, challenge.coupleId))
    .orderBy(asc(coupleMembers.id));

  const isPartnerA = members[0]?.userId === session.user.id;

  if (!accept) {
    // Partner is rejecting — must provide a reason
    if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length === 0) {
      return NextResponse.json(
        { error: "Please explain why the synthesis doesn't feel accurate. Your feedback will help improve it." },
        { status: 400 }
      );
    }

    // Save rejection feedback and reset both acceptances
    const [updated] = await db
      .update(challenges)
      .set({
        rejectionFeedback: rejectionReason.trim(),
        acceptedByA: false,
        acceptedByB: false,
        status: "review",
      })
      .where(eq(challenges.id, id))
      .returning();

    return NextResponse.json({
      ...updated,
      message: "Synthesis rejected. The feedback has been saved. Please regenerate the synthesis to incorporate this feedback.",
      needsRegeneration: true,
    });
  }

  // Partner is accepting
  const updates: Record<string, unknown> = isPartnerA
    ? { acceptedByA: true }
    : { acceptedByB: true };

  // Check if both now accepted
  const otherAccepted = isPartnerA ? challenge.acceptedByB : challenge.acceptedByA;
  if (otherAccepted) {
    updates.status = "discussion";
  } else {
    updates.status = "review";
  }

  const [updated] = await db
    .update(challenges)
    .set(updates)
    .where(eq(challenges.id, id))
    .returning();

  return NextResponse.json({
    ...updated,
    bothAccepted: otherAccepted,
    message: otherAccepted
      ? "Both partners accepted! The discussion thread is now open."
      : "Your acceptance has been recorded. Waiting for your partner to review.",
  });
}
