/**
 * Challenges API — List & Create
 *
 * GET  /api/challenges — List challenges for the user's couple
 * POST /api/challenges — Create a new challenge
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  challenges,
  challengePerspectives,
  coupleMembers,
  couples,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, sql } from "drizzle-orm";

/** Find the couple the user belongs to */
async function getUserCouple(userId: string) {
  const [member] = await db
    .select({
      coupleId: coupleMembers.coupleId,
      couple: {
        id: couples.id,
        status: couples.status,
      },
    })
    .from(coupleMembers)
    .innerJoin(couples, eq(couples.id, coupleMembers.coupleId))
    .where(eq(coupleMembers.userId, userId))
    .limit(1);

  return member || null;
}

/** Get both member user IDs for a couple */
async function getCoupleMembers(coupleId: string) {
  return db
    .select({ userId: coupleMembers.userId, role: coupleMembers.role })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, coupleId));
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couple = await getUserCouple(session.user.id);
  if (!couple) {
    return NextResponse.json({ error: "No couple found. Please join or create a couple first." }, { status: 404 });
  }

  const challengeList = await db
    .select({
      id: challenges.id,
      title: challenges.title,
      category: challenges.category,
      status: challenges.status,
      createdBy: challenges.createdBy,
      createdAt: challenges.createdAt,
      resolvedAt: challenges.resolvedAt,
      perspectivesSubmitted: sql<number>`(
        SELECT COUNT(*)::int FROM challenge_perspectives
        WHERE challenge_id = ${challenges.id} AND submitted = true
      )`,
    })
    .from(challenges)
    .where(eq(challenges.coupleId, couple.coupleId))
    .orderBy(desc(challenges.createdAt));

  return NextResponse.json(challengeList);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couple = await getUserCouple(session.user.id);
  if (!couple) {
    return NextResponse.json({ error: "No couple found. Please join or create a couple first." }, { status: 404 });
  }

  const body = await request.json();
  const { title, category } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const validCategories = [
    "communication", "finances", "parenting", "intimacy",
    "household", "trust", "boundaries", "family", "work_life", "other",
  ];
  const finalCategory = validCategories.includes(category) ? category : "other";

  // Create the challenge
  const [challenge] = await db
    .insert(challenges)
    .values({
      coupleId: couple.coupleId,
      createdBy: session.user.id,
      title: title.trim(),
      category: finalCategory,
      status: "created",
    })
    .returning();

  // Auto-create empty perspectives for both partners
  const members = await getCoupleMembers(couple.coupleId);
  for (const member of members) {
    await db.insert(challengePerspectives).values({
      challengeId: challenge.id,
      userId: member.userId,
    });
  }

  return NextResponse.json(challenge, { status: 201 });
}
