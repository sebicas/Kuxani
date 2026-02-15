/**
 * Gratitude Entries API — List & Create
 *
 * GET  /api/gratitude — List gratitude entries (optional ?days=30, ?shared=true)
 * POST /api/gratitude — Create a new gratitude entry
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gratitudeEntries } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, gte, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30", 10);
  const sharedOnly = searchParams.get("shared") === "true";

  const since = new Date();
  since.setDate(since.getDate() - days);

  const conditions = [
    eq(gratitudeEntries.userId, session.user.id),
    gte(gratitudeEntries.createdAt, since),
  ];

  if (sharedOnly) {
    conditions.push(eq(gratitudeEntries.shared, true));
  }

  const entries = await db
    .select()
    .from(gratitudeEntries)
    .where(and(...conditions))
    .orderBy(desc(gratitudeEntries.createdAt));

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { content, category, shared, aiPrompt, coupleId } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  const validCategories = ["gratitude", "love_note", "appreciation"];
  const safeCategory = validCategories.includes(category) ? category : "gratitude";

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

  return NextResponse.json(entry, { status: 201 });
}
