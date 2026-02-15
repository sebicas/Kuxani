/**
 * Perspectives API — View & Submit
 *
 * GET /api/challenges/[id]/perspectives — Get own + partner's (if both submitted)
 * PUT /api/challenges/[id]/perspectives — Save/submit perspective text
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  challenges,
  challengePerspectives,
  coupleMembers,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { CHALLENGE_UPDATED } from "@/lib/socket/events";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
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

  const perspectives = await db
    .select()
    .from(challengePerspectives)
    .where(eq(challengePerspectives.challengeId, id));

  const bothSubmitted = perspectives.every((p) => p.submitted);
  const mine = perspectives.find((p) => p.userId === session.user.id);
  const partner = perspectives.find((p) => p.userId !== session.user.id);

  return NextResponse.json({
    mine: mine || null,
    partner: partner
      ? {
          ...partner,
          // Only reveal partner's text if both have submitted
          perspectiveText: bothSubmitted ? partner.perspectiveText : null,
        }
      : null,
    bothSubmitted,
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { perspectiveText, submit } = body;

  if (perspectiveText !== undefined && typeof perspectiveText !== "string") {
    return NextResponse.json({ error: "perspectiveText must be a string" }, { status: 400 });
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

  // Find user's perspective
  const [perspective] = await db
    .select()
    .from(challengePerspectives)
    .where(
      and(
        eq(challengePerspectives.challengeId, id),
        eq(challengePerspectives.userId, session.user.id)
      )
    );

  if (!perspective) {
    return NextResponse.json({ error: "Perspective not found" }, { status: 404 });
  }

  if (perspective.submitted) {
    return NextResponse.json(
      { error: "Perspective already submitted. It cannot be changed." },
      { status: 400 }
    );
  }

  // Update perspective
  const updates: Record<string, unknown> = {};
  if (perspectiveText !== undefined) {
    updates.perspectiveText = perspectiveText;
  }
  if (submit) {
    if (!perspectiveText && !perspective.perspectiveText) {
      return NextResponse.json(
        { error: "Cannot submit an empty perspective" },
        { status: 400 }
      );
    }
    updates.submitted = true;
    updates.submittedAt = new Date();
  }

  const [updated] = await db
    .update(challengePerspectives)
    .set(updates)
    .where(eq(challengePerspectives.id, perspective.id))
    .returning();

  // If submitting, check if both are now done and advance challenge status
  if (submit) {
    const allPerspectives = await db
      .select()
      .from(challengePerspectives)
      .where(eq(challengePerspectives.challengeId, id));

    const allSubmitted = allPerspectives.every((p) => p.submitted);

    // Update challenge status based on progress
    if (allSubmitted) {
      await db
        .update(challenges)
        .set({ status: "submitted" })
        .where(eq(challenges.id, id));
    } else if (challenge.status === "created") {
      await db
        .update(challenges)
        .set({ status: "perspectives" })
        .where(eq(challenges.id, id));
    }
  }

  // Emit real-time event to partner
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${challenge.coupleId}`).emit(CHALLENGE_UPDATED, {
      challengeId: id,
      action: submit ? "perspective-submitted" : "perspective-saved",
      userId: session.user.id,
    });
  } catch { /* socket not available in test */ }

  return NextResponse.json(updated);
}
