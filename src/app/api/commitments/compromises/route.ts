/**
 * Compromises API — Cross-app compromise tracker
 *
 * GET  /api/commitments/compromises — List all compromises for the couple
 * POST /api/commitments/compromises — Create a manual compromise
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  compromises,
  coupleMembers,
  couples,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc } from "drizzle-orm";
import { COMPROMISE_CREATED } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

async function getUserCouple(userId: string) {
  const [member] = await db
    .select({
      coupleId: coupleMembers.coupleId,
      couple: { id: couples.id, status: couples.status },
    })
    .from(coupleMembers)
    .innerJoin(couples, eq(couples.id, coupleMembers.coupleId))
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return member || null;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couple = await getUserCouple(session.user.id);
  if (!couple) {
    return NextResponse.json({ error: "No couple found" }, { status: 404 });
  }

  const list = await db
    .select({
      id: compromises.id,
      title: compromises.title,
      description: compromises.description,
      sourceType: compromises.sourceType,
      sourceId: compromises.sourceId,
      proposedBy: compromises.proposedBy,
      partnerACommitment: compromises.partnerACommitment,
      partnerBCommitment: compromises.partnerBCommitment,
      status: compromises.status,
      acceptedByA: compromises.acceptedByA,
      acceptedByB: compromises.acceptedByB,
      checkInFrequency: compromises.checkInFrequency,
      createdAt: compromises.createdAt,
      updatedAt: compromises.updatedAt,
      proposedByName: user.name,
    })
    .from(compromises)
    .leftJoin(user, eq(user.id, compromises.proposedBy))
    .where(eq(compromises.coupleId, couple.coupleId))
    .orderBy(desc(compromises.createdAt));

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couple = await getUserCouple(session.user.id);
  if (!couple) {
    return NextResponse.json({ error: "No couple found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, partnerACommitment, partnerBCommitment, checkInFrequency } = body;

  if (!title || !partnerACommitment || !partnerBCommitment) {
    return NextResponse.json(
      { error: "Title and both partner commitments are required" },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(compromises)
    .values({
      coupleId: couple.coupleId,
      sourceType: "manual",
      proposedBy: session.user.id,
      title: title.trim(),
      description: description || null,
      partnerACommitment: partnerACommitment.trim(),
      partnerBCommitment: partnerBCommitment.trim(),
      checkInFrequency: checkInFrequency || "none",
    })
    .returning();

  // Emit real-time event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${couple.coupleId}`).emit(COMPROMISE_CREATED, {
      compromiseId: created.id,
      sourceType: "manual",
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(created, { status: 201 });
}
