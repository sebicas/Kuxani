/**
 * Gratitude Journal Integration Tests
 *
 * Tests gratitude entry CRUD operations and validation directly
 * via Drizzle ORM against the database.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { gratitudeEntries, user } from "@/lib/db/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

const testEmail = `gratitude-test-${Date.now()}@kuxani.app`;
const testPassword = "GratitudeTest123!";
const testName = "Gratitude Tester";

let testUserId: string;
const createdEntryIds: string[] = [];

describe("Gratitude Journal", () => {
  beforeAll(async () => {
    const result = await auth.api.signUpEmail({
      body: { email: testEmail, password: testPassword, name: testName },
    });
    testUserId = result.user.id;
  });

  afterAll(async () => {
    // Clean up entries
    for (const id of createdEntryIds) {
      await db.delete(gratitudeEntries).where(eq(gratitudeEntries.id, id));
    }
    await db.delete(user).where(eq(user.id, testUserId));
  });

  // ── Create Entries ──

  it("should create a gratitude entry with all fields", async () => {
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: "I'm grateful for my partner's patience today.",
        category: "gratitude",
        aiPrompt: "What are you grateful for today?",
        shared: true,
      })
      .returning();

    expect(entry).toBeDefined();
    expect(entry.content).toBe("I'm grateful for my partner's patience today.");
    expect(entry.category).toBe("gratitude");
    expect(entry.aiPrompt).toBe("What are you grateful for today?");
    expect(entry.shared).toBe(true);
    expect(entry.coupleId).toBeNull();
    expect(entry.createdAt).toBeDefined();

    createdEntryIds.push(entry.id);
  });

  it("should create an entry with minimal fields", async () => {
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: "Thank you for being you.",
      })
      .returning();

    expect(entry).toBeDefined();
    expect(entry.content).toBe("Thank you for being you.");
    expect(entry.category).toBe("gratitude"); // default
    expect(entry.aiPrompt).toBeNull();
    expect(entry.shared).toBe(false); // default
    expect(entry.coupleId).toBeNull();

    createdEntryIds.push(entry.id);
  });

  it("should create entries with different categories", async () => {
    const categories = ["love_note", "appreciation"] as const;
    for (const cat of categories) {
      const [entry] = await db
        .insert(gratitudeEntries)
        .values({
          userId: testUserId,
          content: `Test ${cat} entry`,
          category: cat,
        })
        .returning();

      expect(entry.category).toBe(cat);
      createdEntryIds.push(entry.id);
    }
  });

  // ── Nullable coupleId ──

  it("should allow null coupleId for solo users", async () => {
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: "Solo gratitude entry",
      })
      .returning();

    expect(entry.coupleId).toBeNull();
    createdEntryIds.push(entry.id);
  });

  // ── Query Entries ──

  it("should list entries for a user ordered by date", async () => {
    const entries = await db
      .select()
      .from(gratitudeEntries)
      .where(eq(gratitudeEntries.userId, testUserId))
      .orderBy(desc(gratitudeEntries.createdAt));

    expect(entries.length).toBe(5);
    // Newest first
    for (let i = 1; i < entries.length; i++) {
      expect(new Date(entries[i - 1].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(entries[i].createdAt).getTime());
    }
  });

  it("should filter entries by date range", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const entries = await db
      .select()
      .from(gratitudeEntries)
      .where(
        and(
          eq(gratitudeEntries.userId, testUserId),
          gte(gratitudeEntries.createdAt, yesterday)
        )
      );

    expect(entries.length).toBe(5); // all just created
  });

  it("should filter shared entries only", async () => {
    const entries = await db
      .select()
      .from(gratitudeEntries)
      .where(
        and(
          eq(gratitudeEntries.userId, testUserId),
          eq(gratitudeEntries.shared, true)
        )
      );

    expect(entries.length).toBe(1); // only the first entry was shared
  });

  // ── Privacy ──

  it("should not return entries for a different user", async () => {
    const entries = await db
      .select()
      .from(gratitudeEntries)
      .where(eq(gratitudeEntries.userId, "non-existent-user-id"));

    const found = entries.find((e) => createdEntryIds.includes(e.id));
    expect(found).toBeUndefined();
  });

  // ── Defaults ──

  it("should default shared to false", async () => {
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: "Default sharing test",
      })
      .returning();

    expect(entry.shared).toBe(false);
    createdEntryIds.push(entry.id);
  });

  it("should default category to gratitude", async () => {
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: "Default category test",
      })
      .returning();

    expect(entry.category).toBe("gratitude");
    createdEntryIds.push(entry.id);
  });

  // ── Edge Cases ──

  it("should handle very long content", async () => {
    const longContent = "Grateful ".repeat(1000);
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: longContent,
      })
      .returning();

    expect(entry.content).toBe(longContent);
    expect(entry.content.length).toBe(9000);
    createdEntryIds.push(entry.id);
  });

  it("should handle special characters and unicode", async () => {
    const specialContent = `I'm grateful for "love" — 你好 🎉 <script>alert('xss')</script> & more\n\ttabs`;
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: specialContent,
      })
      .returning();

    expect(entry.content).toBe(specialContent);
    createdEntryIds.push(entry.id);
  });

  it("should allow updating an existing entry content", async () => {
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: "Original content",
      })
      .returning();
    createdEntryIds.push(entry.id);

    const [updated] = await db
      .update(gratitudeEntries)
      .set({ content: "Updated content", shared: true })
      .where(eq(gratitudeEntries.id, entry.id))
      .returning();

    expect(updated.content).toBe("Updated content");
    expect(updated.shared).toBe(true);
  });

  it("should delete an entry without affecting others", async () => {
    const [entryA] = await db
      .insert(gratitudeEntries)
      .values({ userId: testUserId, content: "Keep me" })
      .returning();
    const [entryB] = await db
      .insert(gratitudeEntries)
      .values({ userId: testUserId, content: "Delete me" })
      .returning();
    createdEntryIds.push(entryA.id);

    await db.delete(gratitudeEntries).where(eq(gratitudeEntries.id, entryB.id));

    const remaining = await db
      .select()
      .from(gratitudeEntries)
      .where(eq(gratitudeEntries.id, entryB.id));
    expect(remaining).toHaveLength(0);

    const kept = await db
      .select()
      .from(gratitudeEntries)
      .where(eq(gratitudeEntries.id, entryA.id));
    expect(kept).toHaveLength(1);
  });

  it("should handle long aiPrompt text", async () => {
    const longPrompt = "Reflect on ".repeat(500);
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({
        userId: testUserId,
        content: "Entry with long prompt",
        aiPrompt: longPrompt,
      })
      .returning();

    expect(entry.aiPrompt).toBe(longPrompt);
    createdEntryIds.push(entry.id);
  });

  it("should toggle shared status", async () => {
    const [entry] = await db
      .insert(gratitudeEntries)
      .values({ userId: testUserId, content: "Toggle share test" })
      .returning();
    createdEntryIds.push(entry.id);

    expect(entry.shared).toBe(false);

    const [shared] = await db
      .update(gratitudeEntries)
      .set({ shared: true })
      .where(eq(gratitudeEntries.id, entry.id))
      .returning();
    expect(shared.shared).toBe(true);

    const [unshared] = await db
      .update(gratitudeEntries)
      .set({ shared: false })
      .where(eq(gratitudeEntries.id, entry.id))
      .returning();
    expect(unshared.shared).toBe(false);
  });
});
