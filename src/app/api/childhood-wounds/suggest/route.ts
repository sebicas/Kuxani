/**
 * Childhood Wounds API — Partner Suggestion
 *
 * POST /api/childhood-wounds/suggest — Suggest a wound for the partner
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childhoodWounds, coupleMembers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, ne } from "drizzle-orm";

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

  // Find the user's couple
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, session.user.id))
    .limit(1);

  if (!member) {
    return NextResponse.json(
      { error: "You must be in a couple to suggest wounds" },
      { status: 400 }
    );
  }

  // Find the partner
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

  if (!partner) {
    return NextResponse.json(
      { error: "Partner not found" },
      { status: 404 }
    );
  }

  // Create wound under partner's user_id as a suggestion
  const [wound] = await db
    .insert(childhoodWounds)
    .values({
      userId: partner.userId,
      title: title.trim(),
      description: description?.trim() || null,
      intensity: Math.min(10, Math.max(1, Math.round(Number(intensity) || 5))),
      source: "partner",
      suggestedBy: session.user.id,
      status: "suggested",
    })
    .returning();

  // Emit real-time event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    const { CHILDHOOD_WOUNDS_UPDATED } = await import("@/lib/socket/events");
    getIO()
      .to(`couple:${member.coupleId}`)
      .emit(CHILDHOOD_WOUNDS_UPDATED, {
        action: "wound-suggested",
        userId: session.user.id,
      });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(wound, { status: 201 });
}
