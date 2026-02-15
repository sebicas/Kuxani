/**
 * Personal Chats Integration Tests
 *
 * Tests the personal therapy chat CRUD operations directly
 * via Drizzle ORM against the database. No HTTP server needed.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { personalChats, personalMessages, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Test user credentials (unique per run)
const testEmail = `chat-test-${Date.now()}@kuxani.app`;
const testPassword = "ChatTest123!";
const testName = "Chat Tester";

let testUserId: string;
let testChatId: string;

describe("Personal Chats", () => {
  beforeAll(async () => {
    // Create a test user via Better Auth
    const result = await auth.api.signUpEmail({
      body: { email: testEmail, password: testPassword, name: testName },
    });
    testUserId = result.user.id;
  });

  afterAll(async () => {
    // Clean up: remove test data
    if (testChatId) {
      await db.delete(personalMessages).where(eq(personalMessages.chatId, testChatId));
      await db.delete(personalChats).where(eq(personalChats.id, testChatId));
    }
    // Clean up test user (Better Auth tables)
    await db.delete(user).where(eq(user.id, testUserId));
  });

  // ── CRUD Operations ──

  it("should create a personal chat", async () => {
    const [chat] = await db
      .insert(personalChats)
      .values({
        userId: testUserId,
        title: "Test Chat",
      })
      .returning();

    expect(chat).toBeDefined();
    expect(chat.id).toBeDefined();
    expect(chat.userId).toBe(testUserId);
    expect(chat.title).toBe("Test Chat");
    expect(chat.isShared).toBe(false);

    testChatId = chat.id;
  });

  it("should list chats for a user", async () => {
    const chats = await db
      .select()
      .from(personalChats)
      .where(eq(personalChats.userId, testUserId));

    expect(chats.length).toBeGreaterThanOrEqual(1);
    const found = chats.find((c) => c.id === testChatId);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Test Chat");
  });

  it("should add messages to a chat", async () => {
    const [userMsg] = await db
      .insert(personalMessages)
      .values({
        chatId: testChatId,
        role: "user",
        content: "I've been feeling anxious lately.",
      })
      .returning();

    expect(userMsg).toBeDefined();
    expect(userMsg.role).toBe("user");
    expect(userMsg.content).toBe("I've been feeling anxious lately.");

    const [aiMsg] = await db
      .insert(personalMessages)
      .values({
        chatId: testChatId,
        role: "assistant",
        content: "Thank you for sharing that. Can you tell me more about when you notice the anxiety?",
      })
      .returning();

    expect(aiMsg).toBeDefined();
    expect(aiMsg.role).toBe("assistant");
  });

  it("should retrieve messages in order", async () => {
    const messages = await db
      .select()
      .from(personalMessages)
      .where(eq(personalMessages.chatId, testChatId))
      .orderBy(personalMessages.createdAt);

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  // ── Privacy Controls ──

  it("should toggle chat sharing", async () => {
    // Initially not shared
    const [before] = await db
      .select()
      .from(personalChats)
      .where(eq(personalChats.id, testChatId));
    expect(before.isShared).toBe(false);

    // Enable sharing
    const [updated] = await db
      .update(personalChats)
      .set({ isShared: true })
      .where(eq(personalChats.id, testChatId))
      .returning();
    expect(updated.isShared).toBe(true);

    // Disable sharing
    const [reverted] = await db
      .update(personalChats)
      .set({ isShared: false })
      .where(eq(personalChats.id, testChatId))
      .returning();
    expect(reverted.isShared).toBe(false);
  });

  it("should update chat title", async () => {
    const [updated] = await db
      .update(personalChats)
      .set({ title: "Updated Title" })
      .where(eq(personalChats.id, testChatId))
      .returning();

    expect(updated.title).toBe("Updated Title");
  });

  it("should not find chats for a different user", async () => {
    const chats = await db
      .select()
      .from(personalChats)
      .where(eq(personalChats.userId, "non-existent-user-id"));

    const found = chats.find((c) => c.id === testChatId);
    expect(found).toBeUndefined();
  });

  // ── Deletion ──

  it("should cascade delete messages when chat is deleted", async () => {
    // Verify messages exist before delete
    const messagesBefore = await db
      .select()
      .from(personalMessages)
      .where(eq(personalMessages.chatId, testChatId));
    expect(messagesBefore.length).toBeGreaterThan(0);

    // Delete the chat
    await db.delete(personalChats).where(eq(personalChats.id, testChatId));

    // Messages should be cascade-deleted
    const messagesAfter = await db
      .select()
      .from(personalMessages)
      .where(eq(personalMessages.chatId, testChatId));
    expect(messagesAfter.length).toBe(0);

    // Mark as deleted so afterAll doesn't try to clean up
    testChatId = "";
  });

  // ── Edge Cases ──

  it("should handle very long message content", async () => {
    const [chat] = await db
      .insert(personalChats)
      .values({ userId: testUserId, title: "Long msg chat" })
      .returning();

    const longContent = "Message ".repeat(2000);
    const [msg] = await db
      .insert(personalMessages)
      .values({
        chatId: chat.id,
        role: "user",
        content: longContent,
      })
      .returning();

    expect(msg.content.length).toBe(16000);

    // Cleanup
    await db.delete(personalChats).where(eq(personalChats.id, chat.id));
  });

  it("should handle special characters in messages", async () => {
    const [chat] = await db
      .insert(personalChats)
      .values({ userId: testUserId, title: "Special chars" })
      .returning();

    const specialContent = `I'm feeling "anxious" — <html> & 'stressed' 你好 🎉 \n\t`;
    const [msg] = await db
      .insert(personalMessages)
      .values({
        chatId: chat.id,
        role: "user",
        content: specialContent,
      })
      .returning();

    expect(msg.content).toBe(specialContent);
    await db.delete(personalChats).where(eq(personalChats.id, chat.id));
  });

  it("should handle multiple chats per user", async () => {
    const chatIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const [chat] = await db
        .insert(personalChats)
        .values({ userId: testUserId, title: `Chat ${i + 1}` })
        .returning();
      chatIds.push(chat.id);
    }

    const chats = await db
      .select()
      .from(personalChats)
      .where(eq(personalChats.userId, testUserId));

    expect(chats.length).toBeGreaterThanOrEqual(5);

    // Cleanup
    for (const id of chatIds) {
      await db.delete(personalChats).where(eq(personalChats.id, id));
    }
  });

  it("should handle special characters in title", async () => {
    const specialTitle = `"My Chat" — 你好 🎉 & <test>`;
    const [chat] = await db
      .insert(personalChats)
      .values({ userId: testUserId, title: specialTitle })
      .returning();

    expect(chat.title).toBe(specialTitle);
    await db.delete(personalChats).where(eq(personalChats.id, chat.id));
  });

  it("should handle many messages in a single chat", async () => {
    const [chat] = await db
      .insert(personalChats)
      .values({ userId: testUserId, title: "Many messages chat" })
      .returning();

    for (let i = 0; i < 20; i++) {
      await db.insert(personalMessages).values({
        chatId: chat.id,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
      });
    }

    const messages = await db
      .select()
      .from(personalMessages)
      .where(eq(personalMessages.chatId, chat.id));

    expect(messages).toHaveLength(20);
    await db.delete(personalChats).where(eq(personalChats.id, chat.id));
  });
});
