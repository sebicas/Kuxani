/**
 * Mood Tracker Integration Tests
 *
 * Tests mood entry CRUD operations and validation directly
 * via Drizzle ORM against the database.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { moodEntries, user } from "@/lib/db/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

const testEmail = `mood-test-${Date.now()}@kuxani.app`;
const testPassword = "MoodTest123!";
const testName = "Mood Tester";

let testUserId: string;
const createdEntryIds: string[] = [];

describe("Mood Tracker", () => {
  beforeAll(async () => {
    const result = await auth.api.signUpEmail({
      body: { email: testEmail, password: testPassword, name: testName },
    });
    testUserId = result.user.id;
  });

  afterAll(async () => {
    // Clean up entries
    for (const id of createdEntryIds) {
      await db.delete(moodEntries).where(eq(moodEntries.id, id));
    }
    await db.delete(user).where(eq(user.id, testUserId));
  });

  // ── Create Entries ──

  it("should create a mood entry with all fields", async () => {
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "joy",
        secondaryEmotion: "serenity",
        intensity: 7,
        notes: "Had a great morning with my partner.",
        sharedWithPartner: true,
      })
      .returning();

    expect(entry).toBeDefined();
    expect(entry.primaryEmotion).toBe("joy");
    expect(entry.secondaryEmotion).toBe("serenity");
    expect(entry.intensity).toBe(7);
    expect(entry.notes).toBe("Had a great morning with my partner.");
    expect(entry.sharedWithPartner).toBe(true);
    expect(entry.createdAt).toBeDefined();

    createdEntryIds.push(entry.id);
  });

  it("should create a mood entry with minimal fields", async () => {
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "sadness",
        intensity: 4,
      })
      .returning();

    expect(entry).toBeDefined();
    expect(entry.primaryEmotion).toBe("sadness");
    expect(entry.intensity).toBe(4);
    expect(entry.secondaryEmotion).toBeNull();
    expect(entry.notes).toBeNull();
    expect(entry.sharedWithPartner).toBe(false);

    createdEntryIds.push(entry.id);
  });

  it("should create entries for all Plutchik emotions", async () => {
    const emotions = ["trust", "fear", "surprise", "disgust", "anger", "anticipation"];
    for (const emotion of emotions) {
      const [entry] = await db
        .insert(moodEntries)
        .values({
          userId: testUserId,
          primaryEmotion: emotion,
          intensity: Math.floor(Math.random() * 10) + 1,
        })
        .returning();

      expect(entry.primaryEmotion).toBe(emotion);
      createdEntryIds.push(entry.id);
    }
  });

  // ── Query Entries ──

  it("should list entries for a user ordered by date", async () => {
    const entries = await db
      .select()
      .from(moodEntries)
      .where(eq(moodEntries.userId, testUserId))
      .orderBy(desc(moodEntries.createdAt));

    expect(entries.length).toBe(8); // 2 explicit + 6 Plutchik
    // Should be newest first
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
      .from(moodEntries)
      .where(
        and(
          eq(moodEntries.userId, testUserId),
          gte(moodEntries.createdAt, yesterday)
        )
      );

    // All entries were just created, so all should be within range
    expect(entries.length).toBe(8);
  });

  // ── Intensity Bounds ──

  it("should store intensity values correctly", async () => {
    const [low] = await db
      .insert(moodEntries)
      .values({ userId: testUserId, primaryEmotion: "joy", intensity: 1 })
      .returning();
    expect(low.intensity).toBe(1);
    createdEntryIds.push(low.id);

    const [high] = await db
      .insert(moodEntries)
      .values({ userId: testUserId, primaryEmotion: "anger", intensity: 10 })
      .returning();
    expect(high.intensity).toBe(10);
    createdEntryIds.push(high.id);
  });

  // ── Privacy ──

  it("should not return entries for a different user", async () => {
    const entries = await db
      .select()
      .from(moodEntries)
      .where(eq(moodEntries.userId, "non-existent-user-id"));

    const found = entries.find((e) => createdEntryIds.includes(e.id));
    expect(found).toBeUndefined();
  });

  // ── Sharing Toggle ──

  it("should default sharedWithPartner to false", async () => {
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "trust",
        intensity: 5,
      })
      .returning();

    expect(entry.sharedWithPartner).toBe(false);
    createdEntryIds.push(entry.id);
  });
});
