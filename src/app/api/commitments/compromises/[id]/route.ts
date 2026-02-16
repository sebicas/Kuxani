/**
 * Single Compromise API
 *
 * GET   /api/commitments/compromises/[id] — Get compromise details
 * PATCH /api/commitments/compromises/[id] — Update status or accept
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compromises, coupleMembers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { COMPROMISE_UPDATED } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
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

  return NextResponse.json(comp);
}

export async function PATCH(request: NextRequest, { params }: Params) {
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
  const updates: Record<string, unknown> = {};

  // Handle acceptance by either partner
  if (body.accept === true) {
    // Determine which partner is accepting based on couple member ordering
    const members = await db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(eq(coupleMembers.coupleId, comp.coupleId));

    const isPartnerA = members[0]?.userId === session.user.id;
    if (isPartnerA) {
      updates.acceptedByA = true;
    } else {
      updates.acceptedByB = true;
    }

    // If both accepted, mark as active
    const otherAccepted = isPartnerA ? comp.acceptedByB : comp.acceptedByA;
    if (otherAccepted) {
      updates.status = "active";
    } else {
      updates.status = "accepted";
    }
  }

  if (body.status) {
    const validStatuses = ["proposed", "accepted", "active", "fulfilled", "broken"];
    if (validStatuses.includes(body.status)) {
      updates.status = body.status;
    }
  }

  if (body.title) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(compromises)
    .set(updates)
    .where(eq(compromises.id, id))
    .returning();

  // Emit real-time event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${comp.coupleId}`).emit(COMPROMISE_UPDATED, {
      compromiseId: id,
      status: updated.status,
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(updated);
}
