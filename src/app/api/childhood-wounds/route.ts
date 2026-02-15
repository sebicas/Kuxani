/**
 * Childhood Wounds API — List & Create
 *
 * GET  /api/childhood-wounds — List own wounds (all statuses)
 * POST /api/childhood-wounds — Create a new wound (source: 'self', status: 'active')
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childhoodWounds, coupleMembers, user } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, and, ne } from "drizzle-orm";

/** Find the user's couple ID */
async function getUserCoupleId(userId: string): Promise<string | null> {
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return member?.coupleId || null;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Own wounds (all statuses)
  const myWounds = await db
    .select()
    .from(childhoodWounds)
    .where(eq(childhoodWounds.userId, session.user.id))
    .orderBy(desc(childhoodWounds.intensity), desc(childhoodWounds.createdAt));

  // Find partner
  let partnerWounds: typeof myWounds = [];
  let partnerName: string | null = null;

  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, session.user.id))
    .limit(1);

  if (member) {
    const [partner] = await db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, member.coupleId),
          ne(coupleMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (partner) {
      // Get partner name
      const [partnerUser] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, partner.userId))
        .limit(1);
      partnerName = partnerUser?.name || "Partner";

      // Get partner's active wounds only (not suggested/dismissed)
      partnerWounds = await db
        .select()
        .from(childhoodWounds)
        .where(
          and(
            eq(childhoodWounds.userId, partner.userId),
            eq(childhoodWounds.status, "active")
          )
        )
        .orderBy(desc(childhoodWounds.intensity), desc(childhoodWounds.createdAt));
    }
  }

  return NextResponse.json({ myWounds, partnerWounds, partnerName });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, intensity } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  const [wound] = await db
    .insert(childhoodWounds)
    .values({
      userId: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      intensity: Math.min(10, Math.max(1, Math.round(Number(intensity) || 5))),
      source: body.source === "ai" ? "ai" : "self",
      status: "active",
    })
    .returning();

  // Emit real-time event to partner
  const coupleId = await getUserCoupleId(session.user.id);
  if (coupleId) {
    try {
      const { getIO } = await import("@/lib/socket/socketServer");
      const { CHILDHOOD_WOUNDS_UPDATED } = await import(
        "@/lib/socket/events"
      );
      getIO().to(`couple:${coupleId}`).emit(CHILDHOOD_WOUNDS_UPDATED, {
        action: "wound-created",
        userId: session.user.id,
      });
    } catch {
      /* socket not available in test */
    }
  }

  return NextResponse.json(wound, { status: 201 });
}
