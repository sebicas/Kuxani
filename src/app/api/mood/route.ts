/**
 * Mood Entries API — List & Create
 *
 * GET  /api/mood — List mood entries (optional ?days=7 query param)
 * POST /api/mood — Create a new mood entry
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { moodEntries } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, gte, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30", 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const entries = await db
    .select()
    .from(moodEntries)
    .where(
      and(
        eq(moodEntries.userId, session.user.id),
        gte(moodEntries.createdAt, since)
      )
    )
    .orderBy(desc(moodEntries.createdAt));

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { primaryEmotion, secondaryEmotion, intensity, notes, sharedWithPartner } = body;

  if (!primaryEmotion || typeof intensity !== "number" || intensity < 1 || intensity > 10) {
    return NextResponse.json(
      { error: "primaryEmotion and intensity (1-10) required" },
      { status: 400 }
    );
  }

  const [entry] = await db
    .insert(moodEntries)
    .values({
      userId: session.user.id,
      primaryEmotion,
      secondaryEmotion: secondaryEmotion || null,
      intensity,
      notes: notes || null,
      sharedWithPartner: sharedWithPartner ?? false,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
