/**
 * Compromise Check-In API
 *
 * GET  /api/commitments/compromises/[id]/check-in — List check-ins
 * POST /api/commitments/compromises/[id]/check-in — Submit a check-in
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  compromises,
  commitmentCheckIns,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, desc } from "drizzle-orm";
import { COMPROMISE_UPDATED } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify access
  const [comp] = await db
    .select()
    .from(compromises)
    .where(eq(compromises.id, id));

  if (!comp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, comp.coupleId),
        eq(coupleMembers.userId, session.user.id)
      )
    );

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checkIns = await db
    .select({
      id: commitmentCheckIns.id,
      userId: commitmentCheckIns.userId,
      rating: commitmentCheckIns.rating,
      notes: commitmentCheckIns.notes,
      createdAt: commitmentCheckIns.createdAt,
      userName: user.name,
    })
    .from(commitmentCheckIns)
    .leftJoin(user, eq(user.id, commitmentCheckIns.userId))
    .where(eq(commitmentCheckIns.compromiseId, id))
    .orderBy(desc(commitmentCheckIns.createdAt));

  return NextResponse.json(checkIns);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [comp] = await db
    .select()
    .from(compromises)
    .where(eq(compromises.id, id));

  if (!comp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, comp.coupleId),
        eq(coupleMembers.userId, session.user.id)
      )
    );

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { rating, notes } = body;

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  const [checkIn] = await db
    .insert(commitmentCheckIns)
    .values({
      compromiseId: id,
      userId: session.user.id,
      rating,
      notes: notes || null,
    })
    .returning();

  // Emit real-time event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${comp.coupleId}`).emit(COMPROMISE_UPDATED, {
      compromiseId: id,
      action: "check-in",
      userId: session.user.id,
      rating,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(checkIn, { status: 201 });
}
