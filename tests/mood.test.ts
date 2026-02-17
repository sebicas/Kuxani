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
        primaryEmotion: "happy",
        secondaryEmotion: "serenity",
        intensity: 7,
        notes: "Had a great morning with my partner.",
        sharedWithPartner: true,
      })
      .returning();

    expect(entry).toBeDefined();
    expect(entry.primaryEmotion).toBe("happy");
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
        primaryEmotion: "sad",
        intensity: 4,
      })
      .returning();

    expect(entry).toBeDefined();
    expect(entry.primaryEmotion).toBe("sad");
    expect(entry.intensity).toBe(4);
    expect(entry.secondaryEmotion).toBeNull();
    expect(entry.notes).toBeNull();
    expect(entry.sharedWithPartner).toBe(false);

    createdEntryIds.push(entry.id);
  });

  it("should create entries for all tracked emotions", async () => {
    const emotions = ["calm", "angry", "disappointed", "worried", "scared", "frustrated"];
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
      .values({ userId: testUserId, primaryEmotion: "happy", intensity: 1 })
      .returning();
    expect(low.intensity).toBe(1);
    createdEntryIds.push(low.id);

    const [high] = await db
      .insert(moodEntries)
      .values({ userId: testUserId, primaryEmotion: "angry", intensity: 10 })
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
        primaryEmotion: "calm",
        intensity: 5,
      })
      .returning();

    expect(entry.sharedWithPartner).toBe(false);
    createdEntryIds.push(entry.id);
  });

  // ── Edge Cases ──

  it("should handle very long notes", async () => {
    const longNotes = "Feeling ".repeat(1000);
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "happy",
        intensity: 5,
        notes: longNotes,
      })
      .returning();

    expect(entry.notes).toBe(longNotes);
    expect(entry.notes!.length).toBe(8000);
    createdEntryIds.push(entry.id);
  });

  it("should handle special characters in notes", async () => {
    const specialNotes = `"Feeling" <good> & 'calm' — 你好 🎉`;
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "happy",
        intensity: 5,
        notes: specialNotes,
      })
      .returning();

    expect(entry.notes).toBe(specialNotes);
    createdEntryIds.push(entry.id);
  });

  it("should allow updating intensity of an entry", async () => {
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "angry",
        intensity: 8,
      })
      .returning();
    createdEntryIds.push(entry.id);

    const [updated] = await db
      .update(moodEntries)
      .set({ intensity: 3 })
      .where(eq(moodEntries.id, entry.id))
      .returning();

    expect(updated.intensity).toBe(3);
  });

  it("should toggle sharedWithPartner", async () => {
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "calm",
        intensity: 6,
      })
      .returning();
    createdEntryIds.push(entry.id);

    expect(entry.sharedWithPartner).toBe(false);

    const [shared] = await db
      .update(moodEntries)
      .set({ sharedWithPartner: true })
      .where(eq(moodEntries.id, entry.id))
      .returning();
    expect(shared.sharedWithPartner).toBe(true);

    const [unshared] = await db
      .update(moodEntries)
      .set({ sharedWithPartner: false })
      .where(eq(moodEntries.id, entry.id))
      .returning();
    expect(unshared.sharedWithPartner).toBe(false);
  });

  it("should delete an entry without affecting others", async () => {
    const [entryA] = await db
      .insert(moodEntries)
      .values({ userId: testUserId, primaryEmotion: "happy", intensity: 7 })
      .returning();
    const [entryB] = await db
      .insert(moodEntries)
      .values({ userId: testUserId, primaryEmotion: "sad", intensity: 3 })
      .returning();
    createdEntryIds.push(entryA.id);

    await db.delete(moodEntries).where(eq(moodEntries.id, entryB.id));

    const remaining = await db
      .select()
      .from(moodEntries)
      .where(eq(moodEntries.id, entryB.id));
    expect(remaining).toHaveLength(0);

    const kept = await db
      .select()
      .from(moodEntries)
      .where(eq(moodEntries.id, entryA.id));
    expect(kept).toHaveLength(1);
  });

  it("should handle negative intensity values in the DB", async () => {
    // The DB has no constraint — app layer should validate
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "scared",
        intensity: -1,
      })
      .returning();

    expect(entry.intensity).toBe(-1);
    createdEntryIds.push(entry.id);
  });

  it("should handle intensity beyond 10 in the DB", async () => {
    // The DB has no constraint — app layer should validate
    const [entry] = await db
      .insert(moodEntries)
      .values({
        userId: testUserId,
        primaryEmotion: "happy",
        intensity: 100,
      })
      .returning();

    expect(entry.intensity).toBe(100);
    createdEntryIds.push(entry.id);
  });
});
