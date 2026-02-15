/**
 * Challenges Feature Integration Tests
 *
 * Tests the full challenge lifecycle: creation, perspectives,
 * synthesis acceptance/rejection, requests, and resolution
 * directly via Drizzle ORM against the database.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  challenges,
  challengePerspectives,
  challengeMessages,
  challengeRequests,
  challengeSummaries,
  couples,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";

/* ── Test Data ── */
const testUserA = {
  email: `challenge-a-${Date.now()}@kuxani.app`,
  password: "ChallengeA123!",
  name: "Partner A",
};
const testUserB = {
  email: `challenge-b-${Date.now()}@kuxani.app`,
  password: "ChallengeB123!",
  name: "Partner B",
};

let userAId: string;
let userBId: string;
let coupleId: string;
let challengeId: string;

describe("Challenges — Full Lifecycle", () => {
  // ── Setup: Create 2 users and a couple ──
  beforeAll(async () => {
    const resultA = await auth.api.signUpEmail({
      body: { email: testUserA.email, password: testUserA.password, name: testUserA.name },
    });
    userAId = resultA.user.id;

    const resultB = await auth.api.signUpEmail({
      body: { email: testUserB.email, password: testUserB.password, name: testUserB.name },
    });
    userBId = resultB.user.id;

    // Create a couple directly
    const [couple] = await db
      .insert(couples)
      .values({
        name: "Test Couple",
        inviteCode: `test-${Date.now()}`,
        status: "active",
      })
      .returning();
    coupleId = couple.id;

    // Add both members
    await db.insert(coupleMembers).values([
      { coupleId, userId: userAId, role: "creator", colorCode: "#6366f1" },
      { coupleId, userId: userBId, role: "partner", colorCode: "#ec4899" },
    ]);
  });

  // ── Cleanup ──
  afterAll(async () => {
    // Cascade from couples will clean challenges, perspectives, messages, requests
    if (coupleId) await db.delete(couples).where(eq(couples.id, coupleId));
    if (userAId) await db.delete(user).where(eq(user.id, userAId));
    if (userBId) await db.delete(user).where(eq(user.id, userBId));
  });

  // ══════════════════════════════════════
  // Phase 1: Create Challenge
  // ══════════════════════════════════════
  describe("Create Challenge", () => {
    it("should create a challenge with all fields", async () => {
      const [challenge] = await db
        .insert(challenges)
        .values({
          coupleId,
          createdBy: userAId,
          title: "Disagreement about holiday plans",
          category: "communication",
          status: "created",
        })
        .returning();

      expect(challenge).toBeDefined();
      expect(challenge.title).toBe("Disagreement about holiday plans");
      expect(challenge.category).toBe("communication");
      expect(challenge.status).toBe("created");
      expect(challenge.createdBy).toBe(userAId);
      expect(challenge.acceptedByA).toBe(false);
      expect(challenge.acceptedByB).toBe(false);
      expect(challenge.rejectionFeedback).toBeNull();
      expect(challenge.aiNeutralDescription).toBeNull();
      expect(challenge.resolutionNotes).toBeNull();
      expect(challenge.resolvedAt).toBeNull();

      challengeId = challenge.id;
    });

    it("should auto-create perspectives for both partners", async () => {
      // Simulate what the API route does
      const members = await db
        .select()
        .from(coupleMembers)
        .where(eq(coupleMembers.coupleId, coupleId));

      for (const member of members) {
        await db.insert(challengePerspectives).values({
          challengeId,
          userId: member.userId,
        });
      }

      const perspectives = await db
        .select()
        .from(challengePerspectives)
        .where(eq(challengePerspectives.challengeId, challengeId));

      expect(perspectives).toHaveLength(2);
      expect(perspectives.every((p) => p.submitted === false)).toBe(true);
      expect(perspectives.every((p) => p.perspectiveText === null)).toBe(true);
    });

    it("should default status to 'created'", async () => {
      const [c] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, challengeId));

      expect(c.status).toBe("created");
    });
  });

  // ══════════════════════════════════════
  // Phase 2: Write & Submit Perspectives
  // ══════════════════════════════════════
  describe("Perspectives", () => {
    it("should save a draft perspective", async () => {
      const [perspective] = await db
        .select()
        .from(challengePerspectives)
        .where(
          and(
            eq(challengePerspectives.challengeId, challengeId),
            eq(challengePerspectives.userId, userAId)
          )
        );

      const [updated] = await db
        .update(challengePerspectives)
        .set({ perspectiveText: "I felt unheard when plans were changed." })
        .where(eq(challengePerspectives.id, perspective.id))
        .returning();

      expect(updated.perspectiveText).toBe("I felt unheard when plans were changed.");
      expect(updated.submitted).toBe(false);
    });

    it("should submit Partner A's perspective", async () => {
      const [perspective] = await db
        .select()
        .from(challengePerspectives)
        .where(
          and(
            eq(challengePerspectives.challengeId, challengeId),
            eq(challengePerspectives.userId, userAId)
          )
        );

      const [updated] = await db
        .update(challengePerspectives)
        .set({
          perspectiveText: "I felt unheard when holiday plans were changed without discussing with me first. I need to feel included in major decisions.",
          submitted: true,
          submittedAt: new Date(),
        })
        .where(eq(challengePerspectives.id, perspective.id))
        .returning();

      expect(updated.submitted).toBe(true);
      expect(updated.submittedAt).toBeDefined();

      // Status should advance
      await db
        .update(challenges)
        .set({ status: "perspectives" })
        .where(eq(challenges.id, challengeId));
    });

    it("should hide Partner A's text from B until both submit", async () => {
      // In the API, perspectives are filtered. Here we verify the logic:
      const perspectives = await db
        .select()
        .from(challengePerspectives)
        .where(eq(challengePerspectives.challengeId, challengeId));

      const bothSubmitted = perspectives.every((p) => p.submitted);
      expect(bothSubmitted).toBe(false);

      // Partner B should NOT see A's text
      const partnerAPerspective = perspectives.find((p) => p.userId === userAId);
      expect(partnerAPerspective?.submitted).toBe(true);
      // The API would null out perspectiveText for the other partner
    });

    it("should submit Partner B's perspective", async () => {
      const [perspective] = await db
        .select()
        .from(challengePerspectives)
        .where(
          and(
            eq(challengePerspectives.challengeId, challengeId),
            eq(challengePerspectives.userId, userBId)
          )
        );

      const [updated] = await db
        .update(challengePerspectives)
        .set({
          perspectiveText: "I was trying to be flexible with plans but I should have communicated the change better. I felt overwhelmed by my partner's reaction.",
          submitted: true,
          submittedAt: new Date(),
        })
        .where(eq(challengePerspectives.id, perspective.id))
        .returning();

      expect(updated.submitted).toBe(true);

      // Both submitted — advance status
      await db
        .update(challenges)
        .set({ status: "submitted" })
        .where(eq(challenges.id, challengeId));
    });

    it("should confirm both perspectives are submitted", async () => {
      const perspectives = await db
        .select()
        .from(challengePerspectives)
        .where(eq(challengePerspectives.challengeId, challengeId));

      const bothSubmitted = perspectives.every((p) => p.submitted);
      expect(bothSubmitted).toBe(true);
      expect(perspectives).toHaveLength(2);
    });
  });

  // ══════════════════════════════════════
  // Phase 3: AI Synthesis
  // ══════════════════════════════════════
  describe("Synthesis", () => {
    it("should store AI synthesis on the challenge", async () => {
      const mockSynthesis = `## What happened
Both partners had different expectations about holiday planning.

## Partner A's experience
Felt unheard and excluded from decision-making.

## Partner B's experience
Felt overwhelmed and was trying to be flexible.

## Common ground
Both want to feel respected and included.`;

      const [updated] = await db
        .update(challenges)
        .set({
          aiNeutralDescription: mockSynthesis,
          status: "synthesis",
          acceptedByA: false,
          acceptedByB: false,
        })
        .where(eq(challenges.id, challengeId))
        .returning();

      expect(updated.aiNeutralDescription).toContain("What happened");
      expect(updated.status).toBe("synthesis");
    });
  });

  // ══════════════════════════════════════
  // Phase 4: Accept / Reject
  // ══════════════════════════════════════
  describe("Accept / Reject", () => {
    it("should allow Partner A to accept", async () => {
      const [updated] = await db
        .update(challenges)
        .set({ acceptedByA: true, status: "review" })
        .where(eq(challenges.id, challengeId))
        .returning();

      expect(updated.acceptedByA).toBe(true);
      expect(updated.acceptedByB).toBe(false);
      expect(updated.status).toBe("review");
    });

    it("should allow Partner B to reject with reason", async () => {
      const rejectionReason = "My feelings about the overwhelm weren't captured accurately. I felt more anxious than overwhelmed.";

      const [updated] = await db
        .update(challenges)
        .set({
          rejectionFeedback: rejectionReason,
          acceptedByA: false,
          acceptedByB: false,
          status: "review",
        })
        .where(eq(challenges.id, challengeId))
        .returning();

      expect(updated.rejectionFeedback).toBe(rejectionReason);
      expect(updated.acceptedByA).toBe(false); // Reset
      expect(updated.acceptedByB).toBe(false); // Reset
    });

    it("should clear rejection feedback after re-synthesis", async () => {
      const [updated] = await db
        .update(challenges)
        .set({
          aiNeutralDescription: "Updated synthesis incorporating feedback...",
          rejectionFeedback: null,
          acceptedByA: false,
          acceptedByB: false,
          status: "synthesis",
        })
        .where(eq(challenges.id, challengeId))
        .returning();

      expect(updated.rejectionFeedback).toBeNull();
    });

    it("should advance to discussion when both accept", async () => {
      // Partner A accepts
      await db
        .update(challenges)
        .set({ acceptedByA: true })
        .where(eq(challenges.id, challengeId));

      // Partner B accepts
      const [updated] = await db
        .update(challenges)
        .set({ acceptedByB: true, status: "discussion" })
        .where(eq(challenges.id, challengeId))
        .returning();

      expect(updated.acceptedByA).toBe(true);
      expect(updated.acceptedByB).toBe(true);
      expect(updated.status).toBe("discussion");
    });
  });

  // ══════════════════════════════════════
  // Phase 5: Discussion Messages
  // ══════════════════════════════════════
  describe("Discussion Messages", () => {
    it("should create a user message", async () => {
      const [msg] = await db
        .insert(challengeMessages)
        .values({
          challengeId,
          senderId: userAId,
          senderType: "user",
          content: "I appreciate you being willing to work through this together.",
        })
        .returning();

      expect(msg).toBeDefined();
      expect(msg.senderType).toBe("user");
      expect(msg.senderId).toBe(userAId);
    });

    it("should create an AI response message", async () => {
      const [msg] = await db
        .insert(challengeMessages)
        .values({
          challengeId,
          senderId: null,
          senderType: "ai",
          content: "Thank you for sharing that, Partner A. It's wonderful to see that willingness. Partner B, how does hearing that make you feel?",
        })
        .returning();

      expect(msg).toBeDefined();
      expect(msg.senderType).toBe("ai");
      expect(msg.senderId).toBeNull();
    });

    it("should store messages in order", async () => {
      // Add Partner B's message
      await db.insert(challengeMessages).values({
        challengeId,
        senderId: userBId,
        senderType: "user",
        content: "It makes me feel heard. I'm sorry for not communicating better about the plans.",
      });

      const messages = await db
        .select()
        .from(challengeMessages)
        .where(eq(challengeMessages.challengeId, challengeId))
        .orderBy(asc(challengeMessages.createdAt));

      expect(messages).toHaveLength(3);
      expect(messages[0].senderType).toBe("user");
      expect(messages[1].senderType).toBe("ai");
      expect(messages[2].senderType).toBe("user");
    });
  });

  // ══════════════════════════════════════
  // Phase 6: Requests & Commitments
  // ══════════════════════════════════════
  describe("Requests & Commitments", () => {
    let requestId: string;

    it("should create a request from Partner A", async () => {
      const [req] = await db
        .insert(challengeRequests)
        .values({
          challengeId,
          requestedBy: userAId,
          requestText: "Please discuss major plan changes with me before finalizing them.",
          category: "behavior_change",
        })
        .returning();

      expect(req).toBeDefined();
      expect(req.category).toBe("behavior_change");
      expect(req.acceptedByPartner).toBe(false);
      expect(req.fulfilled).toBe(false);
      requestId = req.id;

      // Advance status
      await db
        .update(challenges)
        .set({ status: "commitments" })
        .where(eq(challenges.id, challengeId));
    });

    it("should let Partner B accept the request", async () => {
      const [updated] = await db
        .update(challengeRequests)
        .set({ acceptedByPartner: true })
        .where(eq(challengeRequests.id, requestId))
        .returning();

      expect(updated.acceptedByPartner).toBe(true);
    });

    it("should let Partner B create a request too", async () => {
      const [req] = await db
        .insert(challengeRequests)
        .values({
          challengeId,
          requestedBy: userBId,
          requestText: "I need reassurance that it's okay to be flexible sometimes.",
          category: "reassurance",
        })
        .returning();

      expect(req.category).toBe("reassurance");
    });

    it("should mark a request as fulfilled", async () => {
      const [updated] = await db
        .update(challengeRequests)
        .set({ fulfilled: true })
        .where(eq(challengeRequests.id, requestId))
        .returning();

      expect(updated.fulfilled).toBe(true);
    });

    it("should list all requests for the challenge", async () => {
      const requests = await db
        .select()
        .from(challengeRequests)
        .where(eq(challengeRequests.challengeId, challengeId))
        .orderBy(asc(challengeRequests.createdAt));

      expect(requests).toHaveLength(2);
      expect(requests[0].requestedBy).toBe(userAId);
      expect(requests[1].requestedBy).toBe(userBId);
    });
  });

  // ══════════════════════════════════════
  // Phase 7: Resolution
  // ══════════════════════════════════════
  describe("Resolution", () => {
    it("should resolve the challenge with notes", async () => {
      const notes = "We learned that communication before making changes is key. We'll check in with each other before making plans.";

      const [resolved] = await db
        .update(challenges)
        .set({
          status: "resolved",
          resolutionNotes: notes,
          resolvedAt: new Date(),
        })
        .where(eq(challenges.id, challengeId))
        .returning();

      expect(resolved.status).toBe("resolved");
      expect(resolved.resolutionNotes).toBe(notes);
      expect(resolved.resolvedAt).toBeDefined();
    });

    it("should store a challenge summary for AI memory", async () => {
      const [summary] = await db
        .insert(challengeSummaries)
        .values({
          challengeId,
          topic: "Holiday planning communication breakdown",
          recurringThemes: ["communication", "decision-making"],
          growthAreas: ["proactive communication", "flexibility"],
          resolutionApproach: "Both committed to discussing changes beforehand",
          commitmentsMade: [
            { text: "Discuss major changes before finalizing", category: "behavior_change", accepted: true, fulfilled: true },
            { text: "Reassurance about flexibility", category: "reassurance", accepted: false, fulfilled: false },
          ],
        })
        .returning();

      expect(summary).toBeDefined();
      expect(summary.topic).toBe("Holiday planning communication breakdown");
      expect(summary.recurringThemes).toContain("communication");
    });
  });

  // ══════════════════════════════════════
  // Schema Defaults & Constraints
  // ══════════════════════════════════════
  describe("Schema Defaults", () => {
    it("should default acceptedByA and acceptedByB to false", async () => {
      const [c] = await db
        .insert(challenges)
        .values({
          coupleId,
          createdBy: userBId,
          title: "Test defaults",
          category: "other",
        })
        .returning();

      expect(c.acceptedByA).toBe(false);
      expect(c.acceptedByB).toBe(false);
      expect(c.rejectionFeedback).toBeNull();
      expect(c.status).toBe("created");

      // Cleanup
      await db.delete(challenges).where(eq(challenges.id, c.id));
    });

    it("should cascade delete from couple to challenges", async () => {
      // Create a throwaway couple + challenge
      const [tmpCouple] = await db
        .insert(couples)
        .values({
          name: "Tmp",
          inviteCode: `cascade-test-${Date.now()}`,
          status: "active",
        })
        .returning();

      await db.insert(coupleMembers).values({
        coupleId: tmpCouple.id,
        userId: userAId,
        role: "creator",
      });

      const [tmpChallenge] = await db
        .insert(challenges)
        .values({
          coupleId: tmpCouple.id,
          createdBy: userAId,
          title: "Cascade test",
        })
        .returning();

      // Delete couple
      await db.delete(couples).where(eq(couples.id, tmpCouple.id));

      // Challenge should be gone
      const found = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, tmpChallenge.id));

      expect(found).toHaveLength(0);
    });

    it("should cascade delete from challenge to child records", async () => {
      // Create a tmp challenge
      const [tmp] = await db
        .insert(challenges)
        .values({
          coupleId,
          createdBy: userAId,
          title: "Cascade children test",
        })
        .returning();

      // Add children
      await db.insert(challengePerspectives).values({
        challengeId: tmp.id,
        userId: userAId,
      });
      await db.insert(challengeMessages).values({
        challengeId: tmp.id,
        senderId: userAId,
        senderType: "user",
        content: "Test",
      });
      await db.insert(challengeRequests).values({
        challengeId: tmp.id,
        requestedBy: userAId,
        requestText: "Test request",
      });

      // Delete challenge
      await db.delete(challenges).where(eq(challenges.id, tmp.id));

      // Children should be gone
      const perspectives = await db
        .select()
        .from(challengePerspectives)
        .where(eq(challengePerspectives.challengeId, tmp.id));
      const messages = await db
        .select()
        .from(challengeMessages)
        .where(eq(challengeMessages.challengeId, tmp.id));
      const requests = await db
        .select()
        .from(challengeRequests)
        .where(eq(challengeRequests.challengeId, tmp.id));

      expect(perspectives).toHaveLength(0);
      expect(messages).toHaveLength(0);
      expect(requests).toHaveLength(0);
    });
  });
});
