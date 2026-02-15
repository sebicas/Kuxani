/**
 * De-escalation Sessions Integration Tests
 *
 * Tests de-escalation session CRUD operations and lifecycle
 * via Drizzle ORM against the database.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { deescalationSessions, user } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

const testEmail = `deesc-test-${Date.now()}@kuxani.app`;
const testPassword = "DeescTest123!";
const testName = "Deesc Tester";

let testUserId: string;
const createdSessionIds: string[] = [];

describe("De-escalation Sessions", () => {
  beforeAll(async () => {
    const result = await auth.api.signUpEmail({
      body: { email: testEmail, password: testPassword, name: testName },
    });
    testUserId = result.user.id;
  });

  afterAll(async () => {
    // Clean up sessions
    for (const id of createdSessionIds) {
      await db
        .delete(deescalationSessions)
        .where(eq(deescalationSessions.id, id));
    }
    await db.delete(user).where(eq(user.id, testUserId));
  });

  // ── Create ──

  it("should create a session with trigger reason", async () => {
    const [session] = await db
      .insert(deescalationSessions)
      .values({
        userId: testUserId,
        triggerReason: "Argument about finances",
      })
      .returning();

    expect(session).toBeDefined();
    expect(session.triggerReason).toBe("Argument about finances");
    expect(session.breathingCompleted).toBe(false);
    expect(session.cooldownMinutes).toBeNull();
    expect(session.aiPromptsUsed).toBeNull();
    expect(session.reflection).toBeNull();
    expect(session.resolvedAt).toBeNull();
    expect(session.coupleId).toBeNull();
    expect(session.createdAt).toBeDefined();

    createdSessionIds.push(session.id);
  });

  it("should create a session without trigger reason", async () => {
    const [session] = await db
      .insert(deescalationSessions)
      .values({
        userId: testUserId,
      })
      .returning();

    expect(session).toBeDefined();
    expect(session.triggerReason).toBeNull();

    createdSessionIds.push(session.id);
  });

  // ── Update: Breathing ──

  it("should mark breathing as completed", async () => {
    const id = createdSessionIds[0];
    const [updated] = await db
      .update(deescalationSessions)
      .set({ breathingCompleted: true })
      .where(eq(deescalationSessions.id, id))
      .returning();

    expect(updated.breathingCompleted).toBe(true);
  });

  // ── Update: Cooldown ──

  it("should set cooldown minutes", async () => {
    const id = createdSessionIds[0];
    const [updated] = await db
      .update(deescalationSessions)
      .set({ cooldownMinutes: 10 })
      .where(eq(deescalationSessions.id, id))
      .returning();

    expect(updated.cooldownMinutes).toBe(10);
  });

  // ── Update: AI Prompts ──

  it("should store AI prompts used", async () => {
    const id = createdSessionIds[0];
    const prompts = [
      "Focus on your breathing",
      "Remember: it's you two vs. the problem",
    ];
    const [updated] = await db
      .update(deescalationSessions)
      .set({ aiPromptsUsed: prompts })
      .where(eq(deescalationSessions.id, id))
      .returning();

    expect(updated.aiPromptsUsed).toEqual(prompts);
  });

  // ── Update: Resolve ──

  it("should mark session as resolved with reflection", async () => {
    const id = createdSessionIds[0];
    const [updated] = await db
      .update(deescalationSessions)
      .set({
        reflection: "I felt calmer after the breathing exercise.",
        resolvedAt: new Date(),
      })
      .where(eq(deescalationSessions.id, id))
      .returning();

    expect(updated.reflection).toBe(
      "I felt calmer after the breathing exercise."
    );
    expect(updated.resolvedAt).toBeDefined();
  });

  // ── Full Lifecycle ──

  it("should support full lifecycle: create → update → resolve", async () => {
    // Create
    const [session] = await db
      .insert(deescalationSessions)
      .values({
        userId: testUserId,
        triggerReason: "Lifecycle test",
      })
      .returning();
    createdSessionIds.push(session.id);

    // Update breathing
    await db
      .update(deescalationSessions)
      .set({ breathingCompleted: true })
      .where(eq(deescalationSessions.id, session.id));

    // Update cooldown
    await db
      .update(deescalationSessions)
      .set({ cooldownMinutes: 5 })
      .where(eq(deescalationSessions.id, session.id));

    // Resolve
    const [final] = await db
      .update(deescalationSessions)
      .set({
        reflection: "Feeling much better now.",
        resolvedAt: new Date(),
      })
      .where(eq(deescalationSessions.id, session.id))
      .returning();

    expect(final.breathingCompleted).toBe(true);
    expect(final.cooldownMinutes).toBe(5);
    expect(final.reflection).toBe("Feeling much better now.");
    expect(final.resolvedAt).toBeDefined();
  });

  // ── Privacy ──

  it("should not return sessions for a different user", async () => {
    const sessions = await db
      .select()
      .from(deescalationSessions)
      .where(eq(deescalationSessions.userId, "non-existent-user-id"));

    const found = sessions.find((s) => createdSessionIds.includes(s.id));
    expect(found).toBeUndefined();
  });

  it("should isolate sessions per user", async () => {
    // Create a second user
    const secondEmail = `deesc-test2-${Date.now()}@kuxani.app`;
    const result = await auth.api.signUpEmail({
      body: {
        email: secondEmail,
        password: "DeescTest123!",
        name: "Deesc Tester 2",
      },
    });
    const secondUserId = result.user.id;

    // Create session for second user
    const [session2] = await db
      .insert(deescalationSessions)
      .values({ userId: secondUserId, triggerReason: "User 2 test" })
      .returning();

    // Query for first user - should not see second user's sessions
    const firstUserSessions = await db
      .select()
      .from(deescalationSessions)
      .where(eq(deescalationSessions.userId, testUserId));

    const leakedSession = firstUserSessions.find(
      (s) => s.id === session2.id
    );
    expect(leakedSession).toBeUndefined();

    // Clean up
    await db
      .delete(deescalationSessions)
      .where(eq(deescalationSessions.id, session2.id));
    await db.delete(user).where(eq(user.id, secondUserId));
  });
});
