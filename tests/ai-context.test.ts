/**
 * AI Context Loader Integration Tests
 *
 * Tests loadCoupleContext() and loadPersonalContext() against the live database.
 * Creates test users, populates data sources, and verifies the context objects.
 *
 * Requires: Docker (PostgreSQL) running
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  user,
  couples,
  coupleMembers,
  coupleProfiles,
  moodEntries,
  deescalationSessions,
  childhoodWounds,
  loveLanguageResults,
  attachmentStyleResults,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { loadCoupleContext, loadPersonalContext } from "@/lib/ai/context";

const ts = Date.now();
const emailA = `ctx-a-${ts}@kuxani.app`;
const emailB = `ctx-b-${ts}@kuxani.app`;
const emailSolo = `ctx-solo-${ts}@kuxani.app`;
const password = "CtxTest123!";

let userIdA: string;
let userIdB: string;
let soloUserId: string;
let coupleId: string;

describe("AI Context Loader", () => {
  beforeAll(async () => {
    // Create test users
    const a = await auth.api.signUpEmail({
      body: { email: emailA, password, name: "Alice Ctx" },
    });
    userIdA = a.user.id;

    const b = await auth.api.signUpEmail({
      body: { email: emailB, password, name: "Bob Ctx" },
    });
    userIdB = b.user.id;

    const solo = await auth.api.signUpEmail({
      body: { email: emailSolo, password, name: "Solo Ctx" },
    });
    soloUserId = solo.user.id;

    // Create a couple
    const [couple] = await db
      .insert(couples)
      .values({ inviteCode: `ctx-${ts}` })
      .returning();
    coupleId = couple.id;

    await db.insert(coupleMembers).values([
      { coupleId, userId: userIdA, role: "creator" },
      { coupleId, userId: userIdB, role: "partner" },
    ]);

    // Populate data sources
    await db.insert(coupleProfiles).values({
      coupleId,
      communicationPatterns: ["pursuer-withdrawer"],
      commonTriggers: ["criticism", "dismissiveness"],
      effectiveStrategies: ["time-outs", "I-statements"],
      recentWins: ["resolved finances discussion"],
    });

    await db.insert(childhoodWounds).values([
      {
        userId: userIdA,
        title: "Abandonment fear",
        intensity: 8,
        source: "self",
        status: "active",
      },
      {
        userId: userIdB,
        title: "Rejection sensitivity",
        intensity: 6,
        source: "self",
        status: "active",
      },
      {
        userId: userIdA,
        title: "Old dismissed wound",
        intensity: 3,
        source: "self",
        status: "dismissed",
      },
    ]);

    await db.insert(loveLanguageResults).values([
      {
        userId: userIdA,
        wordsOfAffirmation: 10,
        actsOfService: 5,
        receivingGifts: 3,
        qualityTime: 8,
        physicalTouch: 4,
      },
      {
        userId: userIdB,
        wordsOfAffirmation: 4,
        actsOfService: 9,
        receivingGifts: 6,
        qualityTime: 7,
        physicalTouch: 4,
      },
    ]);

    await db.insert(attachmentStyleResults).values([
      {
        userId: userIdA,
        secure: 20,
        anxious: 12,
        avoidant: 5,
        fearfulAvoidant: 3,
      },
      {
        userId: userIdB,
        secure: 15,
        anxious: 5,
        avoidant: 18,
        fearfulAvoidant: 2,
      },
    ]);

    await db.insert(moodEntries).values([
      {
        userId: userIdA,
        primaryEmotion: "anxious",
        intensity: 7,
      },
      {
        userId: userIdB,
        primaryEmotion: "calm",
        intensity: 3,
      },
    ]);

    await db.insert(deescalationSessions).values({
      userId: userIdA,
      coupleId,
      triggerReason: "Raised voice during argument",
      reflection: "I need to breathe before responding",
    });
  });

  afterAll(async () => {
    // Clean up in dependency order
    await db.delete(deescalationSessions).where(eq(deescalationSessions.coupleId, coupleId));
    await db.delete(moodEntries).where(inArray(moodEntries.userId, [userIdA, userIdB, soloUserId]));
    await db.delete(attachmentStyleResults).where(inArray(attachmentStyleResults.userId, [userIdA, userIdB, soloUserId]));
    await db.delete(loveLanguageResults).where(inArray(loveLanguageResults.userId, [userIdA, userIdB, soloUserId]));
    await db.delete(childhoodWounds).where(inArray(childhoodWounds.userId, [userIdA, userIdB, soloUserId]));
    await db.delete(coupleProfiles).where(eq(coupleProfiles.coupleId, coupleId));
    await db.delete(coupleMembers).where(eq(coupleMembers.coupleId, coupleId));
    await db.delete(couples).where(eq(couples.id, coupleId));
    await db.delete(user).where(inArray(user.id, [userIdA, userIdB, soloUserId]));
  });

  // ── loadCoupleContext ──

  describe("loadCoupleContext", () => {
    it("should return all populated context sections for a couple", async () => {
      const ctx = await loadCoupleContext(coupleId);

      expect(ctx.coupleProfile).toBeDefined();
      expect(ctx.coupleProfile).toContain("pursuer-withdrawer");

      expect(ctx.partnerProfiles).toBeDefined();

      expect(ctx.childhoodWoundsContext).toBeDefined();
      expect(ctx.childhoodWoundsContext).toContain("Abandonment fear");
      expect(ctx.childhoodWoundsContext).toContain("Rejection sensitivity");

      expect(ctx.attachmentContext).toBeDefined();
      expect(ctx.attachmentContext).toContain("Secure 20");
      expect(ctx.attachmentContext).toContain("Avoidant 18");

      expect(ctx.moodContext).toBeDefined();
      expect(ctx.moodContext).toContain("anxious");
      expect(ctx.moodContext).toContain("calm");

      expect(ctx.deescalationContext).toBeDefined();
      expect(ctx.deescalationContext).toContain("Raised voice");
    });

    it("should exclude dismissed childhood wounds", async () => {
      const ctx = await loadCoupleContext(coupleId);
      expect(ctx.childhoodWoundsContext).not.toContain("Old dismissed wound");
    });

    it("should return gracefully for a nonexistent couple", async () => {
      const ctx = await loadCoupleContext("00000000-0000-4000-8000-000000000000");

      expect(ctx.coupleProfile).toBeUndefined();
      expect(ctx.partnerProfiles).toBeUndefined();
      expect(ctx.childhoodWoundsContext).toBeUndefined();
      expect(ctx.attachmentContext).toBeUndefined();
      expect(ctx.moodContext).toBeUndefined();
      expect(ctx.pastSummaries).toBeUndefined();
    });
  });

  // ── loadPersonalContext ──

  describe("loadPersonalContext", () => {
    it("should return context for a coupled user", async () => {
      const ctx = await loadPersonalContext(userIdA);

      // Couple context should be present since user is in a couple
      expect(ctx.coupleProfile).toBeDefined();
      expect(ctx.coupleProfile).toContain("pursuer-withdrawer");

      // Personal data
      expect(ctx.childhoodWoundsContext).toBeDefined();
      expect(ctx.childhoodWoundsContext).toContain("Abandonment fear");
      expect(ctx.childhoodWoundsContext).not.toContain("Rejection sensitivity"); // partner's wound

      expect(ctx.moodContext).toBeDefined();
      expect(ctx.moodContext).toContain("anxious");

      expect(ctx.deescalationContext).toBeDefined();
      expect(ctx.deescalationContext).toContain("Raised voice");
    });

    it("should return gracefully for a solo user with no data", async () => {
      const ctx = await loadPersonalContext(soloUserId);

      expect(ctx.personalProfile).toBeUndefined();
      expect(ctx.coupleProfile).toBeUndefined();
      expect(ctx.pastSummaries).toBeUndefined();
      expect(ctx.childhoodWoundsContext).toBeUndefined();
      expect(ctx.attachmentContext).toBeUndefined();
      expect(ctx.moodContext).toBeUndefined();
      expect(ctx.deescalationContext).toBeUndefined();
    });

    it("should return gracefully for a nonexistent user", async () => {
      const ctx = await loadPersonalContext("nonexistent-id-12345");

      expect(ctx.personalProfile).toBeUndefined();
      expect(ctx.coupleProfile).toBeUndefined();
    });

    it("should include attachment style data in personalProfile", async () => {
      const ctx = await loadPersonalContext(userIdA);
      expect(ctx.attachmentContext).toBeDefined();
      expect(ctx.attachmentContext).toContain("Secure 20");
    });

    it("should exclude dismissed childhood wounds for personal context", async () => {
      const ctx = await loadPersonalContext(userIdA);
      expect(ctx.childhoodWoundsContext).not.toContain("Old dismissed wound");
    });
  });
});
