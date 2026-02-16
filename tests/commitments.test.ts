/**
 * Commitments Feature Integration Tests
 *
 * Tests the requests, compromises, and check-in lifecycle
 * directly via Drizzle ORM against the database.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  requests,
  compromises,
  commitmentCheckIns,
} from "@/lib/db/schema/commitments";
import { couples, coupleMembers } from "@/lib/db/schema/couples";
import { user } from "@/lib/db/schema/auth";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";

/* ── Test Data ── */
const testUserA = {
  email: `commit-a-${Date.now()}@kuxani.app`,
  password: "CommitA123!",
  name: "Commit A",
};
const testUserB = {
  email: `commit-b-${Date.now()}@kuxani.app`,
  password: "CommitB123!",
  name: "Commit B",
};

let userAId: string;
let userBId: string;
let coupleId: string;
let requestId: string;
let compromiseId: string;

describe("Commitments — Full Lifecycle", () => {
  // ── Setup ──
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
        name: "Commitment Test Couple",
        inviteCode: `commit-test-${Date.now()}`,
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
  // Requests CRUD
  // ══════════════════════════════════════
  describe("Requests", () => {
    it("should create a request with all fields", async () => {
      const [req] = await db
        .insert(requests)
        .values({
          coupleId,
          requestedBy: userAId,
          requestedOf: userBId,
          sourceType: "manual",
          title: "Please give me 30 minutes of quiet time after work",
          description: "I need some decompression time to transition from work mode.",
          category: "boundary",
          priority: "high",
        })
        .returning();

      expect(req).toBeDefined();
      expect(req.requestedBy).toBe(userAId);
      expect(req.requestedOf).toBe(userBId);
      expect(req.sourceType).toBe("manual");
      expect(req.status).toBe("proposed");
      expect(req.priority).toBe("high");
      expect(req.category).toBe("boundary");
      expect(req.title).toBe("Please give me 30 minutes of quiet time after work");
      expect(req.fulfilledAt).toBeNull();

      requestId = req.id;
    });

    it("should accept a request", async () => {
      const [updated] = await db
        .update(requests)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(requests.id, requestId))
        .returning();

      expect(updated.status).toBe("accepted");
    });

    it("should transition accepted → in_progress → fulfilled", async () => {
      await db
        .update(requests)
        .set({ status: "in_progress" })
        .where(eq(requests.id, requestId));

      const [fulfilled] = await db
        .update(requests)
        .set({
          status: "fulfilled",
          fulfilledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(requests.id, requestId))
        .returning();

      expect(fulfilled.status).toBe("fulfilled");
      expect(fulfilled.fulfilledAt).toBeDefined();
    });

    it("should handle declined requests", async () => {
      const [req] = await db
        .insert(requests)
        .values({
          coupleId,
          requestedBy: userBId,
          requestedOf: userAId,
          sourceType: "manual",
          title: "Call me every lunch",
          category: "communication",
        })
        .returning();

      const [declined] = await db
        .update(requests)
        .set({ status: "declined", updatedAt: new Date() })
        .where(eq(requests.id, req.id))
        .returning();

      expect(declined.status).toBe("declined");
      await db.delete(requests).where(eq(requests.id, req.id));
    });

    it("should handle all valid category values", async () => {
      const categories = [
        "behavior",
        "communication",
        "emotional",
        "practical",
        "boundary",
        "other",
      ] as const;

      for (const cat of categories) {
        const [req] = await db
          .insert(requests)
          .values({
            coupleId,
            requestedBy: userAId,
            requestedOf: userBId,
            sourceType: "manual",
            title: `Category: ${cat}`,
            category: cat,
          })
          .returning();

        expect(req.category).toBe(cat);
        await db.delete(requests).where(eq(requests.id, req.id));
      }
    });

    it("should handle all valid priority values", async () => {
      const priorities = ["low", "medium", "high"] as const;

      for (const p of priorities) {
        const [req] = await db
          .insert(requests)
          .values({
            coupleId,
            requestedBy: userAId,
            requestedOf: userBId,
            sourceType: "manual",
            title: `Priority: ${p}`,
            priority: p,
          })
          .returning();

        expect(req.priority).toBe(p);
        await db.delete(requests).where(eq(requests.id, req.id));
      }
    });

    it("should support source types: disagreement, challenge, manual", async () => {
      const sources = ["disagreement", "challenge", "manual"] as const;

      for (const src of sources) {
        const [req] = await db
          .insert(requests)
          .values({
            coupleId,
            requestedBy: userAId,
            requestedOf: userBId,
            sourceType: src,
            title: `Source: ${src}`,
          })
          .returning();

        expect(req.sourceType).toBe(src);
        await db.delete(requests).where(eq(requests.id, req.id));
      }
    });

    it("should support optional dueDate", async () => {
      const dueDate = new Date("2026-06-01");
      const [req] = await db
        .insert(requests)
        .values({
          coupleId,
          requestedBy: userAId,
          requestedOf: userBId,
          sourceType: "manual",
          title: "Time-bound request",
          dueDate,
        })
        .returning();

      expect(req.dueDate).toBeDefined();
      await db.delete(requests).where(eq(requests.id, req.id));
    });
  });

  // ══════════════════════════════════════
  // Compromises CRUD
  // ══════════════════════════════════════
  describe("Compromises", () => {
    it("should create a compromise with both commitments", async () => {
      const [comp] = await db
        .insert(compromises)
        .values({
          coupleId,
          sourceType: "manual",
          proposedBy: userAId,
          title: "Evening routines compromise",
          description: "We'll adjust our evening routines to accommodate both needs.",
          partnerACommitment: "I'll start quiet time at 7pm and join for dinner at 8pm.",
          partnerBCommitment: "I'll respect quiet time and prepare dinner for 8pm.",
          checkInFrequency: "weekly",
        })
        .returning();

      expect(comp).toBeDefined();
      expect(comp.proposedBy).toBe(userAId);
      expect(comp.status).toBe("proposed");
      expect(comp.acceptedByA).toBe(false);
      expect(comp.acceptedByB).toBe(false);
      expect(comp.partnerACommitment).toContain("quiet time");
      expect(comp.partnerBCommitment).toContain("respect");
      expect(comp.checkInFrequency).toBe("weekly");

      compromiseId = comp.id;
    });

    it("should accept by Partner A", async () => {
      const [updated] = await db
        .update(compromises)
        .set({ acceptedByA: true, updatedAt: new Date() })
        .where(eq(compromises.id, compromiseId))
        .returning();

      expect(updated.acceptedByA).toBe(true);
      expect(updated.acceptedByB).toBe(false);
      expect(updated.status).toBe("proposed"); // not yet active
    });

    it("should activate when both accept", async () => {
      const [updated] = await db
        .update(compromises)
        .set({
          acceptedByB: true,
          status: "accepted",
          updatedAt: new Date(),
        })
        .where(eq(compromises.id, compromiseId))
        .returning();

      expect(updated.acceptedByA).toBe(true);
      expect(updated.acceptedByB).toBe(true);
      expect(updated.status).toBe("accepted");
    });

    it("should transition to active status", async () => {
      const [updated] = await db
        .update(compromises)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(compromises.id, compromiseId))
        .returning();

      expect(updated.status).toBe("active");
    });

    it("should handle all check-in frequency values", async () => {
      const frequencies = ["daily", "weekly", "biweekly", "monthly", "none"] as const;

      for (const freq of frequencies) {
        const [comp] = await db
          .insert(compromises)
          .values({
            coupleId,
            sourceType: "manual",
            proposedBy: userAId,
            title: `Freq: ${freq}`,
            partnerACommitment: "A commitment",
            partnerBCommitment: "B commitment",
            checkInFrequency: freq,
          })
          .returning();

        expect(comp.checkInFrequency).toBe(freq);
        await db.delete(compromises).where(eq(compromises.id, comp.id));
      }
    });
  });

  // ══════════════════════════════════════
  // Check-Ins
  // ══════════════════════════════════════
  describe("Check-Ins", () => {
    it("should create a check-in with rating and notes", async () => {
      const [checkIn] = await db
        .insert(commitmentCheckIns)
        .values({
          compromiseId,
          userId: userAId,
          rating: 4,
          notes: "Going well so far, sticking to the routine most days.",
        })
        .returning();

      expect(checkIn).toBeDefined();
      expect(checkIn.userId).toBe(userAId);
      expect(checkIn.rating).toBe(4);
      expect(checkIn.notes).toContain("sticking to the routine");
    });

    it("should allow partner's check-in", async () => {
      const [checkIn] = await db
        .insert(commitmentCheckIns)
        .values({
          compromiseId,
          userId: userBId,
          rating: 5,
          notes: "Dinner has been really enjoyable at 8pm!",
        })
        .returning();

      expect(checkIn.userId).toBe(userBId);
      expect(checkIn.rating).toBe(5);
    });

    it("should support ratings 1-5", async () => {
      for (let r = 1; r <= 5; r++) {
        const [checkIn] = await db
          .insert(commitmentCheckIns)
          .values({
            compromiseId,
            userId: userAId,
            rating: r,
          })
          .returning();

        expect(checkIn.rating).toBe(r);
      }
    });

    it("should allow check-in without notes", async () => {
      const [checkIn] = await db
        .insert(commitmentCheckIns)
        .values({
          compromiseId,
          userId: userAId,
          rating: 3,
        })
        .returning();

      expect(checkIn.notes).toBeNull();
    });

    it("should list check-ins in order", async () => {
      const checkIns = await db
        .select()
        .from(commitmentCheckIns)
        .where(eq(commitmentCheckIns.compromiseId, compromiseId))
        .orderBy(asc(commitmentCheckIns.createdAt));

      expect(checkIns.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ══════════════════════════════════════
  // Cross-Source Aggregation
  // ══════════════════════════════════════
  describe("Cross-Source Aggregation", () => {
    it("should aggregate requests from multiple sources", async () => {
      // Create requests from different sources
      await db.insert(requests).values([
        {
          coupleId,
          requestedBy: userAId,
          requestedOf: userBId,
          sourceType: "disagreement",
          title: "From disagreement",
          sourceId: "00000000-0000-4000-8000-000000000001",
        },
        {
          coupleId,
          requestedBy: userAId,
          requestedOf: userBId,
          sourceType: "challenge",
          title: "From challenge",
          sourceId: "00000000-0000-4000-8000-000000000002",
        },
      ]);

      const all = await db
        .select()
        .from(requests)
        .where(eq(requests.coupleId, coupleId));

      const sources = new Set(all.map((r) => r.sourceType));
      expect(sources.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ══════════════════════════════════════
  // Cascade Deletes
  // ══════════════════════════════════════
  describe("Cascade Deletes", () => {
    it("should cascade delete check-ins when compromise is deleted", async () => {
      const [tmp] = await db
        .insert(compromises)
        .values({
          coupleId,
          sourceType: "manual",
          proposedBy: userAId,
          title: "Cascade test compromise",
          partnerACommitment: "A",
          partnerBCommitment: "B",
        })
        .returning();

      await db.insert(commitmentCheckIns).values({
        compromiseId: tmp.id,
        userId: userAId,
        rating: 3,
      });

      await db.delete(compromises).where(eq(compromises.id, tmp.id));

      const checkIns = await db
        .select()
        .from(commitmentCheckIns)
        .where(eq(commitmentCheckIns.compromiseId, tmp.id));

      expect(checkIns).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════
  // Edge Cases
  // ══════════════════════════════════════
  describe("Edge Cases", () => {
    it("should handle long text in commitments", async () => {
      const longText = "E".repeat(5000);
      const [comp] = await db
        .insert(compromises)
        .values({
          coupleId,
          sourceType: "manual",
          proposedBy: userAId,
          title: "Long commitment",
          partnerACommitment: longText,
          partnerBCommitment: longText,
        })
        .returning();

      expect(comp.partnerACommitment.length).toBe(5000);
      await db.delete(compromises).where(eq(compromises.id, comp.id));
    });

    it("should handle special characters in request title", async () => {
      const special = `Let's "talk" — with <empathy> & love 💕`;
      const [req] = await db
        .insert(requests)
        .values({
          coupleId,
          requestedBy: userAId,
          requestedOf: userBId,
          sourceType: "manual",
          title: special,
        })
        .returning();

      expect(req.title).toBe(special);
      await db.delete(requests).where(eq(requests.id, req.id));
    });

    it("should handle status transitions to broken", async () => {
      const [req] = await db
        .insert(requests)
        .values({
          coupleId,
          requestedBy: userAId,
          requestedOf: userBId,
          sourceType: "manual",
          title: "Broken test",
          status: "in_progress",
        })
        .returning();

      const [broken] = await db
        .update(requests)
        .set({ status: "broken" })
        .where(eq(requests.id, req.id))
        .returning();

      expect(broken.status).toBe("broken");
      await db.delete(requests).where(eq(requests.id, req.id));
    });
  });
});
