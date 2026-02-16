/**
 * Requests API — Cross-app request tracker
 *
 * GET  /api/commitments/requests — List all requests for the couple
 * POST /api/commitments/requests — Create a manual request
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requests,
  coupleMembers,
  couples,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, and, ne } from "drizzle-orm";
import { REQUEST_CREATED } from "@/lib/socket/events";

export const dynamic = "force-dynamic";

async function getUserCouple(userId: string) {
  const [member] = await db
    .select({
      coupleId: coupleMembers.coupleId,
      couple: { id: couples.id, status: couples.status },
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
    return NextResponse.json({ error: "No couple found" }, { status: 404 });
  }

  const list = await db
    .select({
      id: requests.id,
      title: requests.title,
      description: requests.description,
      category: requests.category,
      status: requests.status,
      priority: requests.priority,
      sourceType: requests.sourceType,
      sourceId: requests.sourceId,
      requestedBy: requests.requestedBy,
      requestedOf: requests.requestedOf,
      dueDate: requests.dueDate,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      fulfilledAt: requests.fulfilledAt,
      requestedByName: user.name,
    })
    .from(requests)
    .leftJoin(user, eq(user.id, requests.requestedBy))
    .where(eq(requests.coupleId, couple.coupleId))
    .orderBy(desc(requests.createdAt));

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couple = await getUserCouple(session.user.id);
  if (!couple) {
    return NextResponse.json({ error: "No couple found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, category, priority, dueDate } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Find partner
  const [partner] = await db
    .select({ userId: coupleMembers.userId })
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, couple.coupleId),
        ne(coupleMembers.userId, session.user.id)
      )
    );

  if (!partner) {
    return NextResponse.json({ error: "No partner found" }, { status: 404 });
  }

  const [created] = await db
    .insert(requests)
    .values({
      coupleId: couple.coupleId,
      requestedBy: session.user.id,
      requestedOf: body.requestedOf || partner.userId,
      sourceType: "manual",
      title: title.trim(),
      description: description || null,
      category: category || "other",
      priority: priority || "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  // Emit real-time event
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    getIO().to(`couple:${couple.coupleId}`).emit(REQUEST_CREATED, {
      requestId: created.id,
      sourceType: "manual",
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(created, { status: 201 });
}
