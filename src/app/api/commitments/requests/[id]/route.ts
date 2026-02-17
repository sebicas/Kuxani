/**
 * Single Request API
 *
 * GET   /api/commitments/requests/[id] — Get request details
 * PATCH /api/commitments/requests/[id] — Update status (accept, decline, fulfill, break)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requests, coupleMembers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { REQUEST_UPDATED } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [req] = await db
    .select()
    .from(requests)
    .where(eq(requests.id, id));

  if (!req) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify couple membership
  const [member] = await db
    .select()
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, req.coupleId),
        eq(coupleMembers.userId, session.user.id)
      )
    );

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(req);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [req] = await db
    .select()
    .from(requests)
    .where(eq(requests.id, id));

  if (!req) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify couple membership
  const [member] = await db
    .select()
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, req.coupleId),
        eq(coupleMembers.userId, session.user.id)
      )
    );

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.status) {
    const validStatuses = [
      "proposed",
      "accepted",
      "declined",
      "in_progress",
      "fulfilled",
      "broken",
    ];
    if (validStatuses.includes(body.status)) {
      updates.status = body.status;
      if (body.status === "fulfilled") {
        updates.fulfilledAt = new Date();
      }
    }
  }

  if (body.title) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.priority) updates.priority = body.priority;
  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(requests)
    .set(updates)
    .where(eq(requests.id, id))
    .returning();

  // Emit real-time event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${req.coupleId}`).emit(REQUEST_UPDATED, {
      requestId: id,
      status: updated.status,
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(updated);
}
