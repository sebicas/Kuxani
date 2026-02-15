/**
 * Challenge Detail API — Get, Update, Delete
 *
 * GET    /api/challenges/[id] — Full challenge with perspectives, messages, requests
 * PATCH  /api/challenges/[id] — Update title, status, resolution notes
 * DELETE /api/challenges/[id] — Delete challenge (cascades)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  challenges,
  challengePerspectives,
  challengeMessages,
  challengeRequests,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/** Verify the user belongs to the challenge's couple */
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

/** Determine if user is partner A or B (A = first member by role 'creator') */
async function getPartnerLabel(coupleId: string, userId: string): Promise<"a" | "b"> {
  const members = await db
    .select({ userId: coupleMembers.userId, role: coupleMembers.role })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, coupleId))
    .orderBy(asc(coupleMembers.id));

  // The creator is Partner A, the other is Partner B
  return members[0]?.userId === userId ? "a" : "b";
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

  // Get perspectives
  const perspectives = await db
    .select({
      id: challengePerspectives.id,
      userId: challengePerspectives.userId,
      perspectiveText: challengePerspectives.perspectiveText,
      submitted: challengePerspectives.submitted,
      submittedAt: challengePerspectives.submittedAt,
      userName: user.name,
    })
    .from(challengePerspectives)
    .leftJoin(user, eq(user.id, challengePerspectives.userId))
    .where(eq(challengePerspectives.challengeId, id));

  const bothSubmitted = perspectives.every((p) => p.submitted);

  // Only reveal perspectives to each other if both have submitted
  const safePerspectives = perspectives.map((p) => ({
    ...p,
    perspectiveText:
      p.userId === session.user.id || bothSubmitted
        ? p.perspectiveText
        : null,
  }));

  // Get messages
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

  // Get requests
  const requests = await db
    .select({
      id: challengeRequests.id,
      requestedBy: challengeRequests.requestedBy,
      requestText: challengeRequests.requestText,
      category: challengeRequests.category,
      acceptedByPartner: challengeRequests.acceptedByPartner,
      fulfilled: challengeRequests.fulfilled,
      createdAt: challengeRequests.createdAt,
      requestedByName: user.name,
    })
    .from(challengeRequests)
    .leftJoin(user, eq(user.id, challengeRequests.requestedBy))
    .where(eq(challengeRequests.challengeId, id))
    .orderBy(asc(challengeRequests.createdAt));

  // Get couple members for partner info
  const members = await db
    .select({
      userId: coupleMembers.userId,
      role: coupleMembers.role,
      colorCode: coupleMembers.colorCode,
      userName: user.name,
    })
    .from(coupleMembers)
    .leftJoin(user, eq(user.id, coupleMembers.userId))
    .where(eq(coupleMembers.coupleId, challenge.coupleId))
    .orderBy(asc(coupleMembers.id));

  const partnerLabel = await getPartnerLabel(challenge.coupleId, session.user.id);

  return NextResponse.json({
    ...challenge,
    perspectives: safePerspectives,
    messages,
    requests,
    members,
    currentUserPartner: partnerLabel,
    bothPerspectivesSubmitted: bothSubmitted,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
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
  const updates: Record<string, unknown> = {};

  if (body.title && typeof body.title === "string") {
    updates.title = body.title.trim();
  }
  if (body.resolutionNotes && typeof body.resolutionNotes === "string") {
    updates.resolutionNotes = body.resolutionNotes;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(challenges)
    .set(updates)
    .where(eq(challenges.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const challenge = await verifyAccess(id, session.user.id);
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  await db.delete(challenges).where(eq(challenges.id, id));
  return NextResponse.json({ success: true });
}
