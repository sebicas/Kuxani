/**
 * Join Couple API
 *
 * POST /api/couples/join — Join a couple via invite code
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { couples, coupleMembers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, count } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { inviteCode } = body;

  if (!inviteCode || typeof inviteCode !== "string") {
    return NextResponse.json(
      { error: "Invite code is required" },
      { status: 400 },
    );
  }

  // Check if the user is already in a couple
  const [existingMembership] = await db
    .select({ id: coupleMembers.id })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, session.user.id))
    .limit(1);

  if (existingMembership) {
    return NextResponse.json(
      { error: "You are already part of a couple" },
      { status: 409 },
    );
  }

  // Find the couple by invite code
  const [couple] = await db
    .select()
    .from(couples)
    .where(eq(couples.inviteCode, inviteCode.toUpperCase().trim()))
    .limit(1);

  if (!couple) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 404 },
    );
  }

  if (couple.status !== "pending") {
    return NextResponse.json(
      { error: "This couple already has two partners" },
      { status: 409 },
    );
  }

  // Double-check member count
  const [memberCount] = await db
    .select({ count: count() })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, couple.id));

  if (memberCount.count >= 2) {
    return NextResponse.json(
      { error: "This couple already has two partners" },
      { status: 409 },
    );
  }

  // Prevent self-join (creator trying to join their own couple)
  const [creatorMember] = await db
    .select({ userId: coupleMembers.userId })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, couple.id))
    .limit(1);

  if (creatorMember && creatorMember.userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot join your own couple" },
      { status: 409 },
    );
  }

  // Add partner to the couple
  await db.insert(coupleMembers).values({
    coupleId: couple.id,
    userId: session.user.id,
    role: "partner",
    colorCode: "#ec4899", // Partner B — pink
  });

  // Activate the couple
  await db
    .update(couples)
    .set({ status: "active" })
    .where(eq(couples.id, couple.id));

  // Emit real-time event so Partner A's dashboard updates instantly
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    const { PARTNER_JOINED } = await import("@/lib/socket/events");
    getIO().to(`couple:${couple.id}`).emit(PARTNER_JOINED, {
      name: session.user.name,
      email: session.user.email,
      role: "partner",
    });
  } catch {
    // Socket.IO may not be initialized in test environments — fail silently
  }

  return NextResponse.json(
    {
      coupleId: couple.id,
      status: "active",
      message: "Successfully joined the couple!",
    },
    { status: 200 },
  );
}
