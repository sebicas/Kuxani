/**
 * Disagreements Feature Integration Tests
 *
 * Tests the full disagreement lifecycle: creation, messages,
 * status transitions, invitations, partner join, resolution,
 * and message visibility controls.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  disagreements,
  disagreementMessages,
  disagreementInvitations,
} from "@/lib/db/schema/disagreements";
import { couples, coupleMembers } from "@/lib/db/schema/couples";
import { user } from "@/lib/db/schema/auth";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";

/* ── Test Data ── */
const testUserA = {
  email: `disagreement-a-${Date.now()}@kuxani.app`,
  password: "DisagreeA123!",
  name: "Disagree A",
};
const testUserB = {
  email: `disagreement-b-${Date.now()}@kuxani.app`,
  password: "DisagreeB123!",
  name: "Disagree B",
};

let userAId: string;
let userBId: string;
let coupleId: string;
let disagreementId: string;

describe("Disagreements — Full Lifecycle", () => {
  // ── Setup: Create 2 users and a couple ──
  beforeAll(async () => {
    const resultA = await auth.api.signUpEmail({
      body: {
        email: testUserA.email,
        password: testUserA.password,
        name: testUserA.name,
      },
    });
    userAId = resultA.user.id;

    const resultB = await auth.api.signUpEmail({
      body: {
        email: testUserB.email,
        password: testUserB.password,
        name: testUserB.name,
      },
    });
    userBId = resultB.user.id;

    const [couple] = await db
      .insert(couples)
      .values({
        name: "Disagreement Test Couple",
        inviteCode: `dis-test-${Date.now()}`,
        status: "active",
      })
      .returning();
    coupleId = couple.id;

    await db.insert(coupleMembers).values([
      { coupleId, userId: userAId, role: "creator", colorCode: "#6366f1" },
      { coupleId, userId: userBId, role: "partner", colorCode: "#ec4899" },
    ]);
  });

  // ── Cleanup ──
  afterAll(async () => {
    if (coupleId) await db.delete(couples).where(eq(couples.id, coupleId));
    if (userAId) await db.delete(user).where(eq(user.id, userAId));
    if (userBId) await db.delete(user).where(eq(user.id, userBId));
  });

  // ══════════════════════════════════════
  // Phase 1: Create Disagreement
  // ══════════════════════════════════════
  describe("Create Disagreement", () => {
    it("should create a disagreement with defaults", async () => {
      const [d] = await db
        .insert(disagreements)
        .values({
          userId: userAId,
          coupleId,
          category: "communication",
        })
        .returning();

      expect(d).toBeDefined();
      expect(d.userId).toBe(userAId);
      expect(d.coupleId).toBe(coupleId);
      expect(d.category).toBe("communication");
      expect(d.status).toBe("intake");
      expect(d.visibility).toBe("private");
      expect(d.title).toBe("New Disagreement");
      expect(d.aiSummary).toBeNull();
      expect(d.creatorPerspective).toBeNull();
      expect(d.partnerPerspective).toBeNull();
      expect(d.resolutionNotes).toBeNull();
      expect(d.resolvedAt).toBeNull();

      disagreementId = d.id;
    });

    it("should handle all valid category values", async () => {
      const categories = [
        "communication",
        "finances",
        "intimacy",
        "parenting",
        "chores",
        "boundaries",
        "trust",
        "other",
      ] as const;

      for (const cat of categories) {
        const [d] = await db
          .insert(disagreements)
          .values({
            userId: userAId,
            coupleId,
            category: cat,
          })
          .returning();

        expect(d.category).toBe(cat);
        await db.delete(disagreements).where(eq(disagreements.id, d.id));
      }
    });

    it("should allow custom title", async () => {
      const [d] = await db
        .insert(disagreements)
        .values({
          userId: userAId,
          coupleId,
          title: "Household chore distribution",
          category: "chores",
        })
        .returning();

      expect(d.title).toBe("Household chore distribution");
      await db.delete(disagreements).where(eq(disagreements.id, d.id));
    });
  });

  // ══════════════════════════════════════
  // Phase 2: Status Transitions
  // ══════════════════════════════════════
  describe("Status Transitions", () => {
    it("should transition intake → clarifying", async () => {
      const [updated] = await db
        .update(disagreements)
        .set({ status: "clarifying" })
        .where(eq(disagreements.id, disagreementId))
        .returning();

      expect(updated.status).toBe("clarifying");
    });

    it("should transition clarifying → confirmed", async () => {
      const [updated] = await db
        .update(disagreements)
        .set({
          status: "confirmed",
          aiSummary: "Summary of the disagreement about communication patterns.",
          creatorPerspective: "I feel unheard when decisions are made without me.",
        })
        .where(eq(disagreements.id, disagreementId))
        .returning();

      expect(updated.status).toBe("confirmed");
      expect(updated.aiSummary).toContain("communication patterns");
      expect(updated.creatorPerspective).toBeDefined();
    });

    it("should transition confirmed → invite_sent", async () => {
      const [updated] = await db
        .update(disagreements)
        .set({ status: "invite_sent", visibility: "shared" })
        .where(eq(disagreements.id, disagreementId))
        .returning();

      expect(updated.status).toBe("invite_sent");
      expect(updated.visibility).toBe("shared");
    });

    it("should transition through all remaining statuses", async () => {
      const transitions = [
        "partner_joined",
        "active",
        "resolving",
      ] as const;

      for (const status of transitions) {
        const [updated] = await db
          .update(disagreements)
          .set({ status })
          .where(eq(disagreements.id, disagreementId))
          .returning();

        expect(updated.status).toBe(status);
      }
    });
  });

  // ══════════════════════════════════════
  // Phase 3: Messages
  // ══════════════════════════════════════
  describe("Messages", () => {
    it("should create a user message", async () => {
      const [msg] = await db
        .insert(disagreementMessages)
        .values({
          disagreementId,
          senderId: userAId,
          senderType: "user",
          content: "I feel like we need to talk about how we make decisions.",
          visibleTo: "all",
        })
        .returning();

      expect(msg).toBeDefined();
      expect(msg.senderType).toBe("user");
      expect(msg.senderId).toBe(userAId);
      expect(msg.visibleTo).toBe("all");
    });

    it("should create an AI message", async () => {
      const [msg] = await db
        .insert(disagreementMessages)
        .values({
          disagreementId,
          senderId: null,
          senderType: "ai",
          content: "Thank you for sharing that. Can you tell me more about what happened?",
          visibleTo: "creator_only",
        })
        .returning();

      expect(msg.senderType).toBe("ai");
      expect(msg.senderId).toBeNull();
      expect(msg.visibleTo).toBe("creator_only");
    });

    it("should create a system message", async () => {
      const [msg] = await db
        .insert(disagreementMessages)
        .values({
          disagreementId,
          senderId: null,
          senderType: "system",
          content: "Your partner has been invited to this conversation.",
          visibleTo: "all",
          metadata: { event: "invite_sent" },
        })
        .returning();

      expect(msg.senderType).toBe("system");
      expect(msg.metadata).toEqual({ event: "invite_sent" });
    });

    it("should support partner-only visibility", async () => {
      const [msg] = await db
        .insert(disagreementMessages)
        .values({
          disagreementId,
          senderId: null,
          senderType: "ai",
          content: "Here's your partner's perspective on the situation.",
          visibleTo: "partner_only",
        })
        .returning();

      expect(msg.visibleTo).toBe("partner_only");
    });

    it("should store messages in order", async () => {
      const messages = await db
        .select()
        .from(disagreementMessages)
        .where(eq(disagreementMessages.disagreementId, disagreementId))
        .orderBy(asc(disagreementMessages.createdAt));

      expect(messages.length).toBeGreaterThanOrEqual(4);
      // First message is from user, second from AI
      expect(messages[0].senderType).toBe("user");
      expect(messages[1].senderType).toBe("ai");
      expect(messages[2].senderType).toBe("system");
    });
  });

  // ══════════════════════════════════════
  // Phase 4: Invitations
  // ══════════════════════════════════════
  describe("Invitations", () => {
    let invitationId: string;

    it("should create an invitation", async () => {
      const [inv] = await db
        .insert(disagreementInvitations)
        .values({
          disagreementId,
          invitedBy: userAId,
          invitedUserId: userBId,
          detailLevel: "summary",
        })
        .returning();

      expect(inv).toBeDefined();
      expect(inv.invitedBy).toBe(userAId);
      expect(inv.invitedUserId).toBe(userBId);
      expect(inv.status).toBe("pending");
      expect(inv.detailLevel).toBe("summary");
      expect(inv.respondedAt).toBeNull();

      invitationId = inv.id;
    });

    it("should accept an invitation", async () => {
      const [updated] = await db
        .update(disagreementInvitations)
        .set({
          status: "accepted",
          respondedAt: new Date(),
        })
        .where(eq(disagreementInvitations.id, invitationId))
        .returning();

      expect(updated.status).toBe("accepted");
      expect(updated.respondedAt).toBeDefined();
    });

    it("should support detailed invitation level", async () => {
      const [inv] = await db
        .insert(disagreementInvitations)
        .values({
          disagreementId,
          invitedBy: userAId,
          invitedUserId: userBId,
          detailLevel: "detailed",
        })
        .returning();

      expect(inv.detailLevel).toBe("detailed");
      await db.delete(disagreementInvitations).where(eq(disagreementInvitations.id, inv.id));
    });

    it("should handle declined invitations", async () => {
      const [inv] = await db
        .insert(disagreementInvitations)
        .values({
          disagreementId,
          invitedBy: userAId,
          invitedUserId: userBId,
          detailLevel: "summary",
        })
        .returning();

      const [declined] = await db
        .update(disagreementInvitations)
        .set({ status: "declined", respondedAt: new Date() })
        .where(eq(disagreementInvitations.id, inv.id))
        .returning();

      expect(declined.status).toBe("declined");
      await db.delete(disagreementInvitations).where(eq(disagreementInvitations.id, inv.id));
    });
  });

  // ══════════════════════════════════════
  // Phase 5: Resolution
  // ══════════════════════════════════════
  describe("Resolution", () => {
    it("should resolve with notes", async () => {
      const notes = "We agreed to always discuss major decisions before making them.";

      const [resolved] = await db
        .update(disagreements)
        .set({
          status: "resolved",
          resolutionNotes: notes,
          resolvedAt: new Date(),
        })
        .where(eq(disagreements.id, disagreementId))
        .returning();

      expect(resolved.status).toBe("resolved");
      expect(resolved.resolutionNotes).toBe(notes);
      expect(resolved.resolvedAt).toBeDefined();
    });

    it("should store both perspectives", async () => {
      const [updated] = await db
        .update(disagreements)
        .set({
          partnerPerspective: "I was trying to be efficient with plans but should have communicated.",
        })
        .where(eq(disagreements.id, disagreementId))
        .returning();

      expect(updated.creatorPerspective).toBeDefined();
      expect(updated.partnerPerspective).toBeDefined();
    });
  });

  // ══════════════════════════════════════
  // Cascade Deletes
  // ══════════════════════════════════════
  describe("Cascade Deletes", () => {
    it("should cascade delete messages when disagreement is deleted", async () => {
      const [tmp] = await db
        .insert(disagreements)
        .values({
          userId: userAId,
          coupleId,
          category: "other",
        })
        .returning();

      await db.insert(disagreementMessages).values({
        disagreementId: tmp.id,
        senderId: userAId,
        senderType: "user",
        content: "Test cascade",
        visibleTo: "all",
      });

      // Delete disagreement
      await db.delete(disagreements).where(eq(disagreements.id, tmp.id));

      const messages = await db
        .select()
        .from(disagreementMessages)
        .where(eq(disagreementMessages.disagreementId, tmp.id));

      expect(messages).toHaveLength(0);
    });

    it("should cascade delete invitations when disagreement is deleted", async () => {
      const [tmp] = await db
        .insert(disagreements)
        .values({
          userId: userAId,
          coupleId,
          category: "other",
        })
        .returning();

      await db.insert(disagreementInvitations).values({
        disagreementId: tmp.id,
        invitedBy: userAId,
        invitedUserId: userBId,
        detailLevel: "summary",
      });

      await db.delete(disagreements).where(eq(disagreements.id, tmp.id));

      const invitations = await db
        .select()
        .from(disagreementInvitations)
        .where(eq(disagreementInvitations.disagreementId, tmp.id));

      expect(invitations).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════
  // Edge Cases
  // ══════════════════════════════════════
  describe("Edge Cases", () => {
    it("should handle long message content", async () => {
      const longContent = "D".repeat(10000);
      const [msg] = await db
        .insert(disagreementMessages)
        .values({
          disagreementId,
          senderId: userAId,
          senderType: "user",
          content: longContent,
          visibleTo: "all",
        })
        .returning();

      expect(msg.content.length).toBe(10000);
    });

    it("should handle special characters in content", async () => {
      const special = `It's a "test" — with <html> & unicode: 你好 🎉`;
      const [msg] = await db
        .insert(disagreementMessages)
        .values({
          disagreementId,
          senderId: userAId,
          senderType: "user",
          content: special,
          visibleTo: "all",
        })
        .returning();

      expect(msg.content).toBe(special);
    });

    it("should handle jsonb metadata on messages", async () => {
      const metadata = {
        event: "partner_joined",
        partnerId: userBId,
        timestamp: new Date().toISOString(),
      };

      const [msg] = await db
        .insert(disagreementMessages)
        .values({
          disagreementId,
          senderId: null,
          senderType: "system",
          content: "Partner joined",
          visibleTo: "all",
          metadata,
        })
        .returning();

      expect(msg.metadata).toEqual(metadata);
    });

    it("should allow disagreement without couple (private therapy)", async () => {
      const [d] = await db
        .insert(disagreements)
        .values({
          userId: userAId,
          coupleId: null,
          category: "boundaries",
        })
        .returning();

      expect(d.coupleId).toBeNull();
      expect(d.visibility).toBe("private");
      await db.delete(disagreements).where(eq(disagreements.id, d.id));
    });
  });
});
