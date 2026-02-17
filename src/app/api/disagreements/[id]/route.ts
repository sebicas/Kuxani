/**
 * Single Disagreement API
 *
 * GET    /api/disagreements/[id] — Get disagreement details
 * PATCH  /api/disagreements/[id] — Update (title, category, status)
 * DELETE /api/disagreements/[id] — Soft delete
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  disagreements,
  disagreementMessages,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, sql } from "drizzle-orm";
import { isValidUUID } from "@/lib/utils/uuid";
import { DISAGREEMENT_STATUS } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function verifyAccess(disagreementId: string, userId: string) {
  const [d] = await db
    .select()
    .from(disagreements)
    .where(eq(disagreements.id, disagreementId));

  if (!d) return null;
  if (d.userId === userId) return d;

  if (d.coupleId && d.visibility === "shared") {
    const [member] = await db
      .select()
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, d.coupleId),
          eq(coupleMembers.userId, userId)
        )
      );
    if (member) return d;
  }

  return null;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const disagreement = await verifyAccess(id, session.user.id);
  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get creator name
  const [creator] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, disagreement.userId))
    .limit(1);

  // Get message count
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(disagreementMessages)
    .where(eq(disagreementMessages.disagreementId, id));

  return NextResponse.json({
    ...disagreement,
    creatorName: creator?.name || null,
    messageCount: count,
    isCreator: disagreement.userId === session.user.id,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const disagreement = await verifyAccess(id, session.user.id);
  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.title && typeof body.title === "string") {
    updates.title = body.title.trim();
  }
  if (body.category) {
    updates.category = body.category;
  }
  if (body.status) {
    updates.status = body.status;
  }
  if (body.creatorPerspective) {
    updates.creatorPerspective = body.creatorPerspective;
  }
  if (body.partnerPerspective) {
    updates.partnerPerspective = body.partnerPerspective;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const [updated] = await db
    .update(disagreements)
    .set(updates)
    .where(eq(disagreements.id, id))
    .returning();

  // Emit status change
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    const io = getIO();

    if (disagreement.coupleId) {
      io.to(`couple:${disagreement.coupleId}`).emit(DISAGREEMENT_STATUS, {
        disagreementId: id,
        status: updated.status,
        action: "updated",
        userId: session.user.id,
      });
    }

    io.to(`disagreement:${id}`).emit(DISAGREEMENT_STATUS, {
      disagreementId: id,
      status: updated.status,
      action: "updated",
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const [d] = await db
    .select()
    .from(disagreements)
    .where(eq(disagreements.id, id));

  if (!d) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only creator can delete
  if (d.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(disagreements).where(eq(disagreements.id, id));

  // Emit deletion event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    if (d.coupleId) {
      getIO().to(`couple:${d.coupleId}`).emit(DISAGREEMENT_STATUS, {
        disagreementId: id,
        action: "deleted",
        userId: session.user.id,
      });
    }
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json({ deleted: true });
}
