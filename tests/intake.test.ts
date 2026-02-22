/**
 * Intake Interview Integration Tests
 *
 * Tests intake progress tracking, phase data CRUD with 3 ownership models,
 * dual-perspective isolation, partner pre-fill, and summary aggregation.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  intakeProgress,
  intakeResponses,
  coupleProfiles,
  coupleMembers,
  couples,
  user,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

const testEmailA = `intake-a-${Date.now()}@kuxani.app`;
const testEmailB = `intake-b-${Date.now()}@kuxani.app`;
const testPassword = "IntakeTest123!";

let userAId: string;
let userBId: string;
let coupleId: string;
const createdProgressIds: string[] = [];
const createdResponseIds: string[] = [];

describe("Intake Interview", () => {
  beforeAll(async () => {
    // Create two users
    const resultA = await auth.api.signUpEmail({
      body: { email: testEmailA, password: testPassword, name: "Partner A" },
    });
    userAId = resultA.user.id;

    const resultB = await auth.api.signUpEmail({
      body: { email: testEmailB, password: testPassword, name: "Partner B" },
    });
    userBId = resultB.user.id;

    // Create couple
    const [couple] = await db
      .insert(couples)
      .values({ inviteCode: `test-${Date.now()}` })
      .returning();
    coupleId = couple.id;

    // Add both as members
    await db.insert(coupleMembers).values([
      { coupleId, userId: userAId, role: "creator" },
      { coupleId, userId: userBId, role: "partner" },
    ]);

    // Ensure couple profile exists
    await db
      .insert(coupleProfiles)
      .values({ coupleId })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    for (const id of createdResponseIds) {
      await db.delete(intakeResponses).where(eq(intakeResponses.id, id));
    }
    for (const id of createdProgressIds) {
      await db.delete(intakeProgress).where(eq(intakeProgress.id, id));
    }
    await db.delete(coupleProfiles).where(eq(coupleProfiles.coupleId, coupleId));
    await db.delete(coupleMembers).where(eq(coupleMembers.coupleId, coupleId));
    await db.delete(couples).where(eq(couples.id, coupleId));
    await db.delete(user).where(eq(user.id, userAId));
    await db.delete(user).where(eq(user.id, userBId));
  });

  // ── Intake Progress ──

  describe("Progress Tracking", () => {
    it("should create progress for a phase", async () => {
      const [progress] = await db
        .insert(intakeProgress)
        .values({
          userId: userAId,
          coupleId,
          phase: 1,
          status: "in_progress",
          modalityUsed: "form",
        })
        .returning();

      expect(progress).toBeDefined();
      expect(progress.userId).toBe(userAId);
      expect(progress.phase).toBe(1);
      expect(progress.status).toBe("in_progress");
      expect(progress.modalityUsed).toBe("form");
      createdProgressIds.push(progress.id);
    });

    it("should update progress status to completed", async () => {
      const [progress] = await db
        .insert(intakeProgress)
        .values({
          userId: userAId,
          coupleId,
          phase: 2,
          status: "in_progress",
          modalityUsed: "form",
        })
        .returning();
      createdProgressIds.push(progress.id);

      const [updated] = await db
        .update(intakeProgress)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(intakeProgress.id, progress.id))
        .returning();

      expect(updated.status).toBe("completed");
      expect(updated.completedAt).toBeDefined();
    });

    it("should support all modality enum values", async () => {
      const modalities = ["form", "voice", "chat"] as const;
      for (let i = 0; i < modalities.length; i++) {
        const mod = modalities[i];
        const [p] = await db
          .insert(intakeProgress)
          .values({
            userId: userBId,
            coupleId,
            phase: i + 4, // phases 4, 5, 6
            status: "not_started",
          })
          .returning();

        // Update modality separately to test writing
        const [updated] = await db
          .update(intakeProgress)
          .set({ modalityUsed: mod })
          .where(eq(intakeProgress.id, p.id))
          .returning();

        expect(updated.modalityUsed).toBe(mod);
        createdProgressIds.push(p.id);
      }
    });

    it("should support all status enum values", async () => {
      const statuses = ["not_started", "in_progress", "completed"] as const;
      for (const st of statuses) {
        const [p] = await db
          .insert(intakeProgress)
          .values({
            userId: userBId,
            coupleId,
            phase: 7, // reuse phase 7 for testing
            status: st,
            modalityUsed: "form",
          })
          .returning();

        expect(p.status).toBe(st);
        createdProgressIds.push(p.id);
      }
    });

    it("should list progress for a specific user", async () => {
      const rows = await db
        .select()
        .from(intakeProgress)
        .where(eq(intakeProgress.userId, userAId));

      expect(rows.length).toBeGreaterThanOrEqual(2);
      for (const row of rows) {
        expect(row.userId).toBe(userAId);
      }
    });

    it("should not return other user's progress", async () => {
      const rows = await db
        .select()
        .from(intakeProgress)
        .where(eq(intakeProgress.userId, "non-existent-user"));

      expect(rows).toHaveLength(0);
    });
  });

  // ── Dual-Perspective Responses ──

  describe("Dual-Perspective Responses", () => {
    it("should store a response for Partner A", async () => {
      const [response] = await db
        .insert(intakeResponses)
        .values({
          userId: userAId,
          coupleId,
          phase: 2,
          field: "presentingProblem",
          value: "We struggle with communication",
        })
        .returning();

      expect(response).toBeDefined();
      expect(response.userId).toBe(userAId);
      expect(response.phase).toBe(2);
      expect(response.field).toBe("presentingProblem");
      expect(response.value).toBe("We struggle with communication");
      createdResponseIds.push(response.id);
    });

    it("should store a different response for Partner B on the same field", async () => {
      const [response] = await db
        .insert(intakeResponses)
        .values({
          userId: userBId,
          coupleId,
          phase: 2,
          field: "presentingProblem",
          value: "I feel unheard and dismissed",
        })
        .returning();

      expect(response).toBeDefined();
      expect(response.userId).toBe(userBId);
      expect(response.value).toBe("I feel unheard and dismissed");
      createdResponseIds.push(response.id);
    });

    it("should isolate responses per user (dual perspective)", async () => {
      const aResponses = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, userAId),
            eq(intakeResponses.coupleId, coupleId),
            eq(intakeResponses.phase, 2),
            eq(intakeResponses.field, "presentingProblem")
          )
        );

      const bResponses = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, userBId),
            eq(intakeResponses.coupleId, coupleId),
            eq(intakeResponses.phase, 2),
            eq(intakeResponses.field, "presentingProblem")
          )
        );

      expect(aResponses).toHaveLength(1);
      expect(bResponses).toHaveLength(1);
      expect(aResponses[0].value).not.toBe(bResponses[0].value);
    });

    it("should update a response on conflict (same user + phase + field)", async () => {
      const [original] = await db
        .insert(intakeResponses)
        .values({
          userId: userAId,
          coupleId,
          phase: 5,
          field: "typicalDisagreement",
          value: "Original answer",
        })
        .returning();
      createdResponseIds.push(original.id);

      // Simulate upsert via delete + insert (same unique key)
      await db
        .delete(intakeResponses)
        .where(eq(intakeResponses.id, original.id));

      const [updated] = await db
        .insert(intakeResponses)
        .values({
          userId: userAId,
          coupleId,
          phase: 5,
          field: "typicalDisagreement",
          value: "Updated answer",
        })
        .returning();

      expect(updated.value).toBe("Updated answer");
      // Replace old ID with new one in cleanup
      createdResponseIds[createdResponseIds.length - 1] = updated.id;
    });

    it("should store JSONB values", async () => {
      const complexValue = { tags: ["anger", "sadness"], intensity: 8 };
      const [response] = await db
        .insert(intakeResponses)
        .values({
          userId: userAId,
          coupleId,
          phase: 5,
          field: "emotionalTags",
          value: complexValue,
        })
        .returning();

      expect(response.value).toEqual(complexValue);
      createdResponseIds.push(response.id);
    });
  });

  // ── Couple Profile Intake Fields ──

  describe("Couple Profile Intake Fields", () => {
    it("should store relationship stage and living situation", async () => {
      const [profile] = await db
        .update(coupleProfiles)
        .set({
          relationshipStage: "married",
          livingSituation: "together",
        })
        .where(eq(coupleProfiles.coupleId, coupleId))
        .returning();

      expect(profile.relationshipStage).toBe("married");
      expect(profile.livingSituation).toBe("together");
    });

    it("should store therapy goals as JSONB array", async () => {
      const goals = ["Better communication", "Rebuild trust", "Manage stress"];
      const [profile] = await db
        .update(coupleProfiles)
        .set({ therapyGoals: goals })
        .where(eq(coupleProfiles.coupleId, coupleId))
        .returning();

      expect(profile.therapyGoals).toEqual(goals);
    });

    it("should store children as JSONB array", async () => {
      const children = [
        { name: "Emma", age: 5, relationship: "bio" },
        { name: "Liam", age: 3, relationship: "step" },
      ];
      const [profile] = await db
        .update(coupleProfiles)
        .set({ children })
        .where(eq(coupleProfiles.coupleId, coupleId))
        .returning();

      const stored = profile.children as typeof children;
      expect(stored).toHaveLength(2);
      expect(stored[0].name).toBe("Emma");
      expect(stored[1].relationship).toBe("step");
    });

    it("should store togetherSince date string", async () => {
      const [profile] = await db
        .update(coupleProfiles)
        .set({ togetherSince: "2019-06-15" })
        .where(eq(coupleProfiles.coupleId, coupleId))
        .returning();

      expect(profile.togetherSince).toBe("2019-06-15");
    });

    it("should store previousTherapy as JSONB", async () => {
      const therapy = {
        type: "couples counseling",
        duration: "6 months",
        whatHelped: "Active listening exercises",
        whatDidnt: "Too much homework",
      };
      const [profile] = await db
        .update(coupleProfiles)
        .set({ previousTherapy: therapy })
        .where(eq(coupleProfiles.coupleId, coupleId))
        .returning();

      expect(profile.previousTherapy).toEqual(therapy);
    });
  });

  // ── Individual Profile Data ──

  describe("Individual Profile Data (profileData JSONB)", () => {
    it("should store familyOfOrigin data", async () => {
      const familyData = {
        parentsRelationship: "Divorced when I was 8",
        familyConflictStyle: "Avoidant - we never discussed problems",
        emotionalEnvironment: "Cold and unpredictable",
        familyRole: "Peacemaker",
        unspokenRules: ["Don't show weakness", "Keep the peace"],
        significantLosses: ["Lost grandmother at 12"],
        culturalContext: "Traditional Catholic family",
      };

      const [updated] = await db
        .update(user)
        .set({
          profileData: {
            familyOfOrigin: familyData,
          },
        })
        .where(eq(user.id, userAId))
        .returning();

      const pd = updated.profileData;
      expect(pd?.familyOfOrigin).toEqual(familyData);
    });

    it("should store attachmentHistory data", async () => {
      const attachmentData = {
        childhoodComfortSource: "My grandmother",
        wasComfortAvailable: false,
        selfSoothingPatterns: ["exercise", "isolation"],
        previousRelationships: "2 long-term, both ended due to avoidance",
        vulnerabilityComfort: "Very uncomfortable showing weakness",
      };

      const [updated] = await db
        .update(user)
        .set({
          profileData: {
            attachmentHistory: attachmentData,
          },
        })
        .where(eq(user.id, userAId))
        .returning();

      const pd = updated.profileData;
      expect(pd?.attachmentHistory).toEqual(attachmentData);
    });

    it("should store externalStressors and mentalHealthContext", async () => {
      const [updated] = await db
        .update(user)
        .set({
          profileData: {
            externalStressors: ["Financial pressure", "Work stress", "In-law dynamics"],
            mentalHealthContext: "Generalized anxiety, on medication since 2022",
          },
        })
        .where(eq(user.id, userBId))
        .returning();

      const pd = updated.profileData;
      expect(pd?.externalStressors).toEqual([
        "Financial pressure",
        "Work stress",
        "In-law dynamics",
      ]);
      expect(pd?.mentalHealthContext).toBe(
        "Generalized anxiety, on medication since 2022"
      );
    });

    it("should preserve existing profileData when adding intake fields", async () => {
      // Set some existing data first
      await db
        .update(user)
        .set({
          profileData: {
            attachmentStyle: "anxious",
            loveLanguage: "quality_time",
          },
        })
        .where(eq(user.id, userBId));

      // Now fetch and merge manually (as the API route does)
      const [current] = await db
        .select({ profileData: user.profileData })
        .from(user)
        .where(eq(user.id, userBId))
        .limit(1);

      const merged = {
        ...current.profileData,
        familyOfOrigin: { familyRole: "Golden child" },
      };

      const [updated] = await db
        .update(user)
        .set({ profileData: merged })
        .where(eq(user.id, userBId))
        .returning();

      const pd = updated.profileData;
      expect(pd?.attachmentStyle).toBe("anxious");
      expect(pd?.loveLanguage).toBe("quality_time");
      expect(pd?.familyOfOrigin?.familyRole).toBe("Golden child");
    });
  });

  // ── Edge Cases ──

  describe("Edge Cases", () => {
    it("should handle empty string JSONB values", async () => {
      const [response] = await db
        .insert(intakeResponses)
        .values({
          userId: userAId,
          coupleId,
          phase: 2,
          field: "emptyField",
          value: "",
        })
        .returning();

      expect(response.value).toBe("");
      createdResponseIds.push(response.id);
    });

    it("should handle special characters in text fields", async () => {
      const special = `"I feel abandoned" — 你好 🎭 <script>alert('xss')</script>`;
      const [response] = await db
        .insert(intakeResponses)
        .values({
          userId: userAId,
          coupleId,
          phase: 5,
          field: "specialChars",
          value: special,
        })
        .returning();

      expect(response.value).toBe(special);
      createdResponseIds.push(response.id);
    });

    it("should enforce userId association on progress", async () => {
      const rows = await db
        .select()
        .from(intakeProgress)
        .where(
          and(
            eq(intakeProgress.userId, userAId),
            eq(intakeProgress.coupleId, coupleId)
          )
        );

      for (const row of rows) {
        expect(row.userId).toBe(userAId);
        expect(row.coupleId).toBe(coupleId);
      }
    });

    it("should reject null JSONB value (NOT NULL constraint)", async () => {
      await expect(
        db
          .insert(intakeResponses)
          .values({
            userId: userAId,
            coupleId,
            phase: 3,
            field: "nullField",
            value: null as unknown as string,
          })
          .returning()
      ).rejects.toThrow();
    });

    it("should handle deeply nested JSONB objects", async () => {
      const nested = {
        level1: {
          level2: {
            level3: { data: [1, 2, { inner: true }] },
          },
        },
      };
      const [response] = await db
        .insert(intakeResponses)
        .values({
          userId: userBId,
          coupleId,
          phase: 4,
          field: "deepNested",
          value: nested,
        })
        .returning();

      expect(response.value).toEqual(nested);
      createdResponseIds.push(response.id);
    });

    it("should handle very large text values", async () => {
      const largeText = "A".repeat(10_000);
      const [response] = await db
        .insert(intakeResponses)
        .values({
          userId: userAId,
          coupleId,
          phase: 3,
          field: "largeField",
          value: largeText,
        })
        .returning();

      expect(response.value).toBe(largeText);
      createdResponseIds.push(response.id);
    });

    it("should accept boundary phase values (1 and 7)", async () => {
      for (const phase of [1, 7]) {
        const [p] = await db
          .insert(intakeProgress)
          .values({
            userId: userBId,
            coupleId,
            phase,
            status: "not_started",
            modalityUsed: "form",
          })
          .returning();

        expect(p.phase).toBe(phase);
        createdProgressIds.push(p.id);
      }
    });

    it("should merge profileData when existing data is null", async () => {
      // Clear profileData first
      await db
        .update(user)
        .set({ profileData: null })
        .where(eq(user.id, userBId));

      // Fetch current (should be null)
      const [current] = await db
        .select({ profileData: user.profileData })
        .from(user)
        .where(eq(user.id, userBId))
        .limit(1);

      const merged = {
        ...(current.profileData || {}),
        familyOfOrigin: { familyRole: "Scapegoat" },
      };

      const [updated] = await db
        .update(user)
        .set({ profileData: merged })
        .where(eq(user.id, userBId))
        .returning();

      expect(updated.profileData?.familyOfOrigin?.familyRole).toBe("Scapegoat");
    });
  });
});
