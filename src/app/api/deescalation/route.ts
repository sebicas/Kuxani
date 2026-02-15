/**
 * De-escalation API — Create & Update sessions
 *
 * POST  /api/deescalation         — Start a new session
 * GET   /api/deescalation         — List sessions
 * PATCH /api/deescalation         — Update a session (pass id in body)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deescalationSessions } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, and } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db
    .select()
    .from(deescalationSessions)
    .where(eq(deescalationSessions.userId, session.user.id))
    .orderBy(desc(deescalationSessions.createdAt))
    .limit(20);

  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine, we'll use defaults
  }
  const { triggerReason, coupleId } = body as { triggerReason?: string; coupleId?: string };

  const [deescSession] = await db
    .insert(deescalationSessions)
    .values({
      userId: session.user.id,
      coupleId: coupleId || null,
      triggerReason: triggerReason || null,
    })
    .returning();

  return NextResponse.json(deescSession, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, breathingCompleted, cooldownMinutes, aiPromptsUsed, reflection, resolved } = body;

  if (!id) {
    return NextResponse.json({ error: "Session id is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (breathingCompleted !== undefined) updateData.breathingCompleted = breathingCompleted;
  if (cooldownMinutes !== undefined) updateData.cooldownMinutes = cooldownMinutes;
  if (aiPromptsUsed !== undefined) updateData.aiPromptsUsed = aiPromptsUsed;
  if (reflection !== undefined) updateData.reflection = reflection;
  if (resolved) updateData.resolvedAt = new Date();

  const [updated] = await db
    .update(deescalationSessions)
    .set(updateData)
    .where(
      and(
        eq(deescalationSessions.id, id),
        eq(deescalationSessions.userId, session.user.id)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
