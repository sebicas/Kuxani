/**
 * Mood Tracker API — List & Create
 *
 * GET  /api/mood — List own entries + partner's shared entries
 * POST /api/mood — Log a mood entry (emits real-time event when shared)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { moodEntries, coupleMembers, user } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, gte, and, ne } from "drizzle-orm";

/** Find the user's couple ID */
async function getUserCoupleId(userId: string): Promise<string | null> {
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return member?.coupleId || null;
}

/** Find partner's userId in the same couple */
async function getPartnerId(
  userId: string,
  coupleId: string
): Promise<string | null> {
  const [partner] = await db
    .select({ userId: coupleMembers.userId })
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, coupleId),
        ne(coupleMembers.userId, userId)
      )
    )
    .limit(1);
  return partner?.userId || null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30", 10);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get own entries
  const ownEntries = await db
    .select()
    .from(moodEntries)
    .where(
      and(
        eq(moodEntries.userId, session.user.id),
        gte(moodEntries.createdAt, since)
      )
    )
    .orderBy(desc(moodEntries.createdAt));

  // Get partner's shared entries
  const coupleId = await getUserCoupleId(session.user.id);
  let partnerEntries: Array<typeof ownEntries[number] & { isPartnerEntry?: boolean; partnerName?: string }> = [];

  if (coupleId) {
    const partnerId = await getPartnerId(session.user.id, coupleId);
    if (partnerId) {
      const [partnerUser] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, partnerId))
        .limit(1);

      const partnerName = partnerUser?.name || "Partner";

      const raw = await db
        .select()
        .from(moodEntries)
        .where(
          and(
            eq(moodEntries.userId, partnerId),
            eq(moodEntries.sharedWithPartner, true),
            gte(moodEntries.createdAt, since)
          )
        )
        .orderBy(desc(moodEntries.createdAt));

      partnerEntries = raw.map((e) => ({
        ...e,
        isPartnerEntry: true,
        partnerName,
      }));
    }
  }

  // Merge and sort by date
  const all = [...ownEntries, ...partnerEntries].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(all);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { primaryEmotion, secondaryEmotion, intensity, notes, sharedWithPartner } =
    body;

  if (!primaryEmotion || typeof primaryEmotion !== "string") {
    return NextResponse.json(
      { error: "Primary emotion is required" },
      { status: 400 }
    );
  }

  const safeIntensity = Math.min(10, Math.max(1, parseInt(intensity) || 5));

  const [entry] = await db
    .insert(moodEntries)
    .values({
      userId: session.user.id,
      primaryEmotion,
      secondaryEmotion: secondaryEmotion || null,
      intensity: safeIntensity,
      notes: notes || null,
      sharedWithPartner: sharedWithPartner ?? false,
    })
    .returning();

  // Emit real-time event to partner when shared
  if (sharedWithPartner) {
    const coupleId = await getUserCoupleId(session.user.id);
    if (coupleId) {
      try {
        const { getIO } = await import("@/lib/socket/socketServer");
        const { MOOD_UPDATED } = await import("@/lib/socket/events");
        getIO().to(`couple:${coupleId}`).emit(MOOD_UPDATED, {
          entryId: entry.id,
          action: "mood-shared",
          userId: session.user.id,
        });
      } catch {
        /* socket not available in test */
      }
    }
  }

  return NextResponse.json(entry, { status: 201 });
}
