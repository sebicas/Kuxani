/**
 * Personal Chats API — List & Create
 *
 * GET  /api/personal/chats — List user's personal chats
 * POST /api/personal/chats — Create a new chat
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { personalChats } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get chats with last message preview
  const chats = await db
    .select({
      id: personalChats.id,
      title: personalChats.title,
      isShared: personalChats.isShared,
      createdAt: personalChats.createdAt,
      lastMessage: sql<string>`(
        SELECT content FROM personal_messages
        WHERE chat_id = ${personalChats.id}
        ORDER BY created_at DESC LIMIT 1
      )`,
      lastMessageAt: sql<Date>`(
        SELECT created_at FROM personal_messages
        WHERE chat_id = ${personalChats.id}
        ORDER BY created_at DESC LIMIT 1
      )`,
      messageCount: sql<number>`(
        SELECT COUNT(*)::int FROM personal_messages
        WHERE chat_id = ${personalChats.id}
      )`,
    })
    .from(personalChats)
    .where(eq(personalChats.userId, session.user.id))
    .orderBy(desc(personalChats.createdAt));

  return NextResponse.json(chats);
}

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [chat] = await db
    .insert(personalChats)
    .values({
      userId: session.user.id,
      title: "New Chat",
    })
    .returning();

  return NextResponse.json(chat, { status: 201 });
}
