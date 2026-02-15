/**
 * Childhood Wounds API — Single Wound Operations
 *
 * PUT    /api/childhood-wounds/:id — Edit own wound (title, description)
 * DELETE /api/childhood-wounds/:id — Remove own wound
 * PATCH  /api/childhood-wounds/:id — Accept/dismiss a suggestion
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childhoodWounds, coupleMembers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

/** Find the user's couple ID */
async function getUserCoupleId(userId: string): Promise<string | null> {
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return member?.coupleId || null;
}

/** Emit real-time event to couple room */
async function emitUpdate(userId: string, action: string) {
  const coupleId = await getUserCoupleId(userId);
  if (!coupleId) return;
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    const { CHILDHOOD_WOUNDS_UPDATED } = await import("@/lib/socket/events");
    getIO().to(`couple:${coupleId}`).emit(CHILDHOOD_WOUNDS_UPDATED, {
      action,
      userId,
    });
  } catch {
    /* socket not available in test */
  }
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, description, intensity } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(childhoodWounds)
    .set({
      title: title.trim(),
      description: description?.trim() || null,
      ...(intensity !== undefined && {
        intensity: Math.min(10, Math.max(1, Math.round(Number(intensity)))),
      }),
    })
    .where(
      and(
        eq(childhoodWounds.id, id),
        eq(childhoodWounds.userId, session.user.id)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Wound not found or not yours" },
      { status: 404 }
    );
  }

  await emitUpdate(session.user.id, "wound-updated");
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(childhoodWounds)
    .where(
      and(
        eq(childhoodWounds.id, id),
        eq(childhoodWounds.userId, session.user.id)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json(
      { error: "Wound not found or not yours" },
      { status: 404 }
    );
  }

  await emitUpdate(session.user.id, "wound-deleted");
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["active", "dismissed"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'active' or 'dismissed'" },
      { status: 400 }
    );
  }

  // Only update wounds that are currently 'suggested' and belong to the user
  const [updated] = await db
    .update(childhoodWounds)
    .set({ status })
    .where(
      and(
        eq(childhoodWounds.id, id),
        eq(childhoodWounds.userId, session.user.id),
        eq(childhoodWounds.status, "suggested")
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Suggestion not found or already resolved" },
      { status: 404 }
    );
  }

  await emitUpdate(session.user.id, "wound-suggestion-resolved");
  return NextResponse.json(updated);
}
