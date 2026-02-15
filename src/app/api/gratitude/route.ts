/**
 * Gratitude Entries API — List & Create
 *
 * GET  /api/gratitude — List own entries + partner's shared entries
 * POST /api/gratitude — Create a new gratitude entry (emits real-time event)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gratitudeEntries, coupleMembers, user } from "@/lib/db/schema";
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
    .select({
      id: gratitudeEntries.id,
      userId: gratitudeEntries.userId,
      content: gratitudeEntries.content,
      category: gratitudeEntries.category,
      aiPrompt: gratitudeEntries.aiPrompt,
      shared: gratitudeEntries.shared,
      createdAt: gratitudeEntries.createdAt,
    })
    .from(gratitudeEntries)
    .where(
      and(
        eq(gratitudeEntries.userId, session.user.id),
        gte(gratitudeEntries.createdAt, since)
      )
    )
    .orderBy(desc(gratitudeEntries.createdAt));

  // Get partner's shared entries
  const coupleId = await getUserCoupleId(session.user.id);
  let partnerEntries: typeof ownEntries = [];

  if (coupleId) {
    const partnerId = await getPartnerId(session.user.id, coupleId);
    if (partnerId) {
      // Get partner display name
      const [partnerUser] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, partnerId))
        .limit(1);

      const partnerName = partnerUser?.name || "Partner";

      const raw = await db
        .select({
          id: gratitudeEntries.id,
          userId: gratitudeEntries.userId,
          content: gratitudeEntries.content,
          category: gratitudeEntries.category,
          aiPrompt: gratitudeEntries.aiPrompt,
          shared: gratitudeEntries.shared,
          createdAt: gratitudeEntries.createdAt,
        })
        .from(gratitudeEntries)
        .where(
          and(
            eq(gratitudeEntries.userId, partnerId),
            eq(gratitudeEntries.shared, true),
            gte(gratitudeEntries.createdAt, since)
          )
        )
        .orderBy(desc(gratitudeEntries.createdAt));

      partnerEntries = raw.map((e) => ({
        ...e,
        // Tag partner entries so the client can style them differently
        isPartnerEntry: true,
        partnerName,
      })) as typeof ownEntries;
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
  const { content, category, shared, aiPrompt } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  const validCategories = ["gratitude", "love_note", "appreciation"];
  const safeCategory = validCategories.includes(category)
    ? category
    : "gratitude";

  // Resolve coupleId server-side
  const coupleId = await getUserCoupleId(session.user.id);

  const [entry] = await db
    .insert(gratitudeEntries)
    .values({
      userId: session.user.id,
      coupleId: coupleId || null,
      content: content.trim(),
      category: safeCategory,
      aiPrompt: aiPrompt || null,
      shared: shared ?? false,
    })
    .returning();

  // Emit real-time event to partner when shared
  if (shared && coupleId) {
    try {
      const { getIO } = await import("@/lib/socket/socketServer");
      const { GRATITUDE_UPDATED } = await import("@/lib/socket/events");
      getIO().to(`couple:${coupleId}`).emit(GRATITUDE_UPDATED, {
        entryId: entry.id,
        action: "gratitude-shared",
        userId: session.user.id,
      });
    } catch {
      /* socket not available in test */
    }
  }

  return NextResponse.json(entry, { status: 201 });
}
