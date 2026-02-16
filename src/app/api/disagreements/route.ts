/**
 * Disagreements API — List & Create
 *
 * GET  /api/disagreements — List disagreements for the user's couple
 * POST /api/disagreements — Create a new disagreement + AI greeting
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  disagreements,
  disagreementMessages,
  coupleMembers,
  couples,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, or, and, sql } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import { DISAGREEMENT_INTAKE_PROMPT, buildSystemPrompt } from "@/lib/ai/prompts";
import { loadPersonalContext } from "@/lib/ai/context";
import { DISAGREEMENT_STATUS } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couple = await getUserCouple(session.user.id);
  if (!couple) {
    return NextResponse.json(
      { error: "No couple found. Please join or create a couple first." },
      { status: 404 }
    );
  }

  const list = await db
    .select({
      id: disagreements.id,
      title: disagreements.title,
      category: disagreements.category,
      status: disagreements.status,
      visibility: disagreements.visibility,
      createdAt: disagreements.createdAt,
      resolvedAt: disagreements.resolvedAt,
      lastMessageAt: sql<Date>`(
        SELECT MAX(created_at) FROM disagreement_messages
        WHERE disagreement_id = ${disagreements.id}
      )`,
      messageCount: sql<number>`(
        SELECT COUNT(*)::int FROM disagreement_messages
        WHERE disagreement_id = ${disagreements.id}
      )`,
    })
    .from(disagreements)
    .where(
      or(
        // Owned by me
        eq(disagreements.userId, session.user.id),
        // Shared with my couple
        and(
          eq(disagreements.coupleId, couple.coupleId),
          eq(disagreements.visibility, "shared")
        )
      )
    )
    .orderBy(desc(disagreements.createdAt));

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couple = await getUserCouple(session.user.id);
  if (!couple) {
    return NextResponse.json(
      { error: "No couple found." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const category = body.category || "other";

  // Create the disagreement
  const [disagreement] = await db
    .insert(disagreements)
    .values({
      userId: session.user.id,
      coupleId: couple.coupleId,
      category,
      status: "intake",
      visibility: "private",
    })
    .returning();

  // Generate AI greeting
  const ctx = await loadPersonalContext(session.user.id);
  const systemPrompt = buildSystemPrompt({
    basePrompt: DISAGREEMENT_INTAKE_PROMPT,
    ...ctx,
  });

  const completion = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: "I want to talk about something that's been bothering me with my partner.",
      },
    ],
  });

  const greeting = completion.choices[0]?.message?.content || "Welcome. What's on your mind?";

  // Save AI greeting
  await db.insert(disagreementMessages).values({
    disagreementId: disagreement.id,
    senderId: null,
    senderType: "ai",
    content: greeting,
    visibleTo: "creator_only",
  });

  // Emit real-time event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${couple.coupleId}`).emit(DISAGREEMENT_STATUS, {
      disagreementId: disagreement.id,
      status: "intake",
      action: "created",
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(
    { ...disagreement, greeting },
    { status: 201 }
  );
}
