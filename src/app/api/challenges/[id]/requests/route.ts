/**
 * Requests & Commitments API
 *
 * GET   /api/challenges/[id]/requests — List all requests
 * POST  /api/challenges/[id]/requests — Submit a new request
 * PATCH /api/challenges/[id]/requests — Accept or mark as fulfilled
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  challenges,
  challengeRequests,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { CHALLENGE_UPDATED } from "@/lib/socket/events";

type Params = { params: Promise<{ id: string }> };

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

  return NextResponse.json(requests);
}

export async function POST(request: NextRequest, { params }: Params) {
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
  const { requestText, category } = body;

  if (!requestText || typeof requestText !== "string" || requestText.trim().length === 0) {
    return NextResponse.json({ error: "Request text is required" }, { status: 400 });
  }

  const validCategories = ["apology", "behavior_change", "reassurance", "boundary", "other"];
  const finalCategory = validCategories.includes(category) ? category : "other";

  const [req] = await db
    .insert(challengeRequests)
    .values({
      challengeId: id,
      requestedBy: session.user.id,
      requestText: requestText.trim(),
      category: finalCategory,
    })
    .returning();

  // Advance status to commitments if in discussion
  if (challenge.status === "discussion") {
    await db
      .update(challenges)
      .set({ status: "commitments" })
      .where(eq(challenges.id, id));
  }

  // Emit real-time event to partner
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${challenge.coupleId}`).emit(CHALLENGE_UPDATED, {
      challengeId: id,
      action: "request-created",
      userId: session.user.id,
    });
  } catch { /* socket not available in test */ }

  return NextResponse.json(req, { status: 201 });
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
  const { requestId, acceptedByPartner, fulfilled } = body;

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  // Verify the request exists for this challenge
  const [req] = await db
    .select()
    .from(challengeRequests)
    .where(
      and(
        eq(challengeRequests.id, requestId),
        eq(challengeRequests.challengeId, id)
      )
    );

  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  // Only the partner (not the requester) can accept
  if (typeof acceptedByPartner === "boolean") {
    if (req.requestedBy === session.user.id) {
      return NextResponse.json(
        { error: "You cannot accept your own request" },
        { status: 400 }
      );
    }
    updates.acceptedByPartner = acceptedByPartner;
  }

  // Either partner can mark as fulfilled
  if (typeof fulfilled === "boolean") {
    updates.fulfilled = fulfilled;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(challengeRequests)
    .set(updates)
    .where(eq(challengeRequests.id, requestId))
    .returning();

  // Emit real-time event to partner
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${challenge.coupleId}`).emit(CHALLENGE_UPDATED, {
      challengeId: id,
      action: "request-updated",
      userId: session.user.id,
    });
  } catch { /* socket not available in test */ }

  return NextResponse.json(updated);
}
