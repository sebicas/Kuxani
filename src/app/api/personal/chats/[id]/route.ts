/**
 * Personal Chat Detail API — Get, Update, Delete
 *
 * GET    /api/personal/chats/[id] — Get chat with all messages
 * PATCH  /api/personal/chats/[id] — Update title or sharing
 * DELETE /api/personal/chats/[id] — Delete chat
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { personalChats, personalMessages } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get chat (ensure ownership)
  const [chat] = await db
    .select()
    .from(personalChats)
    .where(
      and(eq(personalChats.id, id), eq(personalChats.userId, session.user.id))
    );

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Get messages
  const messages = await db
    .select()
    .from(personalMessages)
    .where(eq(personalMessages.chatId, id))
    .orderBy(asc(personalMessages.createdAt));

  return NextResponse.json({ ...chat, messages });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.isShared === "boolean") updates.isShared = body.isShared;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [chat] = await db
    .update(personalChats)
    .set(updates)
    .where(
      and(eq(personalChats.id, id), eq(personalChats.userId, session.user.id))
    )
    .returning();

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json(chat);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(personalChats)
    .where(
      and(eq(personalChats.id, id), eq(personalChats.userId, session.user.id))
    )
    .returning({ id: personalChats.id });

  if (!deleted) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
