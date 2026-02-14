/**
 * Love Languages Integration Tests
 *
 * Tests love language quiz results storage, retrieval, and partner
 * comparison lookup directly via Drizzle ORM.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { loveLanguageResults, user } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

const testEmail1 = `ll-test1-${Date.now()}@kuxani.app`;
const testEmail2 = `ll-test2-${Date.now()}@kuxani.app`;
const testPassword = "LoveTest123!";

let userId1: string;
let userId2: string;
const createdIds: string[] = [];

describe("Love Languages", () => {
  beforeAll(async () => {
    const result1 = await auth.api.signUpEmail({
      body: { email: testEmail1, password: testPassword, name: "User 1" },
    });
    userId1 = result1.user.id;

    const result2 = await auth.api.signUpEmail({
      body: { email: testEmail2, password: testPassword, name: "User 2" },
    });
    userId2 = result2.user.id;
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.delete(loveLanguageResults).where(eq(loveLanguageResults.id, id));
    }
    await db.delete(user).where(eq(user.id, userId1));
    await db.delete(user).where(eq(user.id, userId2));
  });

  // ── Save Results ──

  it("should save quiz results for a user", async () => {
    const [result] = await db
      .insert(loveLanguageResults)
      .values({
        userId: userId1,
        wordsOfAffirmation: 8,
        actsOfService: 5,
        receivingGifts: 3,
        qualityTime: 10,
        physicalTouch: 4,
      })
      .returning();

    expect(result).toBeDefined();
    expect(result.wordsOfAffirmation).toBe(8);
    expect(result.actsOfService).toBe(5);
    expect(result.receivingGifts).toBe(3);
    expect(result.qualityTime).toBe(10);
    expect(result.physicalTouch).toBe(4);
    expect(result.userId).toBe(userId1);

    createdIds.push(result.id);
  });

  it("should save results for a second user (partner)", async () => {
    const [result] = await db
      .insert(loveLanguageResults)
      .values({
        userId: userId2,
        wordsOfAffirmation: 3,
        actsOfService: 9,
        receivingGifts: 6,
        qualityTime: 4,
        physicalTouch: 8,
      })
      .returning();

    expect(result).toBeDefined();
    expect(result.actsOfService).toBe(9);
    expect(result.userId).toBe(userId2);

    createdIds.push(result.id);
  });

  // ── Retrieve Results ──

  it("should retrieve the latest result for a user", async () => {
    const [result] = await db
      .select()
      .from(loveLanguageResults)
      .where(eq(loveLanguageResults.userId, userId1))
      .orderBy(desc(loveLanguageResults.createdAt))
      .limit(1);

    expect(result).toBeDefined();
    expect(result.qualityTime).toBe(10); // Highest score
    expect(result.userId).toBe(userId1);
  });

  // ── Retake Support ──

  it("should allow saving multiple results (retake quiz)", async () => {
    const [secondResult] = await db
      .insert(loveLanguageResults)
      .values({
        userId: userId1,
        wordsOfAffirmation: 6,
        actsOfService: 7,
        receivingGifts: 5,
        qualityTime: 8,
        physicalTouch: 4,
      })
      .returning();

    createdIds.push(secondResult.id);

    // Latest should reflect the new scores
    const [latest] = await db
      .select()
      .from(loveLanguageResults)
      .where(eq(loveLanguageResults.userId, userId1))
      .orderBy(desc(loveLanguageResults.createdAt))
      .limit(1);

    expect(latest.id).toBe(secondResult.id);
    expect(latest.actsOfService).toBe(7); // Updated score
  });

  // ── Score Calculation ──

  it("should correctly identify top love language from scores", () => {
    const scores = {
      W: 8,
      A: 5,
      G: 3,
      Q: 10,
      T: 4,
    };

    const entries = Object.entries(scores) as Array<[string, number]>;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const topLanguage = sorted[0][0];

    expect(topLanguage).toBe("Q"); // Quality Time
    expect(sorted[0][1]).toBe(10);
  });

  it("should rank all five languages correctly", () => {
    const scores = {
      wordsOfAffirmation: 8,
      actsOfService: 5,
      receivingGifts: 3,
      qualityTime: 10,
      physicalTouch: 4,
    };

    const ranked = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([key]) => key);

    expect(ranked).toEqual([
      "qualityTime",
      "wordsOfAffirmation",
      "actsOfService",
      "physicalTouch",
      "receivingGifts",
    ]);
  });

  // ── User Isolation ──

  it("should not return results for a different user", async () => {
    const results = await db
      .select()
      .from(loveLanguageResults)
      .where(eq(loveLanguageResults.userId, "non-existent-user"));

    expect(results.length).toBe(0);
  });
});
