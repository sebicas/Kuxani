/**
 * Childhood Wounds Integration Tests
 *
 * Tests childhood wound CRUD operations, suggestion workflow,
 * and access control directly via Drizzle ORM.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { childhoodWounds, user } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

const testEmailA = `cw-test-a-${Date.now()}@kuxani.app`;
const testEmailB = `cw-test-b-${Date.now()}@kuxani.app`;
const testPassword = "CWTest123!";

let userAId: string;
let userBId: string;
const createdWoundIds: string[] = [];

describe("Childhood Wounds", () => {
  beforeAll(async () => {
    const resultA = await auth.api.signUpEmail({
      body: { email: testEmailA, password: testPassword, name: "Partner A" },
    });
    userAId = resultA.user.id;

    const resultB = await auth.api.signUpEmail({
      body: { email: testEmailB, password: testPassword, name: "Partner B" },
    });
    userBId = resultB.user.id;
  });

  afterAll(async () => {
    for (const id of createdWoundIds) {
      await db.delete(childhoodWounds).where(eq(childhoodWounds.id, id));
    }
    await db.delete(user).where(eq(user.id, userAId));
    await db.delete(user).where(eq(user.id, userBId));
  });

  // ── Create ──

  it("should create a wound with all fields", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Fear of abandonment",
        description: "Worry that partner will leave when conflict arises",
        source: "self",
        status: "active",
      })
      .returning();

    expect(wound).toBeDefined();
    expect(wound.title).toBe("Fear of abandonment");
    expect(wound.description).toBe(
      "Worry that partner will leave when conflict arises"
    );
    expect(wound.source).toBe("self");
    expect(wound.status).toBe("active");
    expect(wound.suggestedBy).toBeNull();
    expect(wound.createdAt).toBeDefined();
    expect(wound.updatedAt).toBeDefined();

    createdWoundIds.push(wound.id);
  });

  it("should create a wound with minimal fields", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Emotional neglect",
      })
      .returning();

    expect(wound).toBeDefined();
    expect(wound.title).toBe("Emotional neglect");
    expect(wound.description).toBeNull();
    expect(wound.source).toBe("self"); // default
    expect(wound.status).toBe("active"); // default

    createdWoundIds.push(wound.id);
  });

  // ── Defaults ──

  it("should default source to 'self'", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Default source test",
      })
      .returning();

    expect(wound.source).toBe("self");
    createdWoundIds.push(wound.id);
  });

  it("should default status to 'active'", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Default status test",
      })
      .returning();

    expect(wound.status).toBe("active");
    createdWoundIds.push(wound.id);
  });

  // ── Query ──

  it("should list wounds for a user ordered by date", async () => {
    const wounds = await db
      .select()
      .from(childhoodWounds)
      .where(eq(childhoodWounds.userId, userAId))
      .orderBy(desc(childhoodWounds.createdAt));

    expect(wounds.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < wounds.length; i++) {
      expect(
        new Date(wounds[i - 1].createdAt).getTime()
      ).toBeGreaterThanOrEqual(new Date(wounds[i].createdAt).getTime());
    }
  });

  it("should not return wounds for a different user", async () => {
    const wounds = await db
      .select()
      .from(childhoodWounds)
      .where(eq(childhoodWounds.userId, "non-existent-user-id"));

    const found = wounds.find((w) => createdWoundIds.includes(w.id));
    expect(found).toBeUndefined();
  });

  // ── Update ──

  it("should update a wound's title and description", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Original title",
        description: "Original description",
      })
      .returning();
    createdWoundIds.push(wound.id);

    const [updated] = await db
      .update(childhoodWounds)
      .set({
        title: "Updated title",
        description: "Updated description",
      })
      .where(eq(childhoodWounds.id, wound.id))
      .returning();

    expect(updated.title).toBe("Updated title");
    expect(updated.description).toBe("Updated description");
  });

  it("should only update own wound (scoped by userId)", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "User A's wound",
      })
      .returning();
    createdWoundIds.push(wound.id);

    // Attempt to update with wrong userId
    const result = await db
      .update(childhoodWounds)
      .set({ title: "Hijacked" })
      .where(
        and(
          eq(childhoodWounds.id, wound.id),
          eq(childhoodWounds.userId, userBId)
        )
      )
      .returning();

    expect(result).toHaveLength(0); // No rows updated

    // Verify original unchanged
    const [original] = await db
      .select()
      .from(childhoodWounds)
      .where(eq(childhoodWounds.id, wound.id));
    expect(original.title).toBe("User A's wound");
  });

  // ── Delete ──

  it("should delete a wound without affecting others", async () => {
    const [keep] = await db
      .insert(childhoodWounds)
      .values({ userId: userAId, title: "Keep me" })
      .returning();
    const [remove] = await db
      .insert(childhoodWounds)
      .values({ userId: userAId, title: "Delete me" })
      .returning();
    createdWoundIds.push(keep.id);

    await db.delete(childhoodWounds).where(eq(childhoodWounds.id, remove.id));

    const remaining = await db
      .select()
      .from(childhoodWounds)
      .where(eq(childhoodWounds.id, remove.id));
    expect(remaining).toHaveLength(0);

    const kept = await db
      .select()
      .from(childhoodWounds)
      .where(eq(childhoodWounds.id, keep.id));
    expect(kept).toHaveLength(1);
  });

  it("should only delete own wound (scoped by userId)", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({ userId: userAId, title: "Protected wound" })
      .returning();
    createdWoundIds.push(wound.id);

    // Attempt to delete with wrong userId
    const result = await db
      .delete(childhoodWounds)
      .where(
        and(
          eq(childhoodWounds.id, wound.id),
          eq(childhoodWounds.userId, userBId)
        )
      )
      .returning();

    expect(result).toHaveLength(0);

    // Verify still exists
    const [exists] = await db
      .select()
      .from(childhoodWounds)
      .where(eq(childhoodWounds.id, wound.id));
    expect(exists).toBeDefined();
  });

  // ── Suggestion Workflow ──

  it("should create a partner suggestion with correct fields", async () => {
    const [suggestion] = await db
      .insert(childhoodWounds)
      .values({
        userId: userBId, // created under partner's ID
        title: "People-pleasing tendency",
        description: "May stem from needing approval as a child",
        source: "partner",
        suggestedBy: userAId, // suggested by partner A
        status: "suggested",
      })
      .returning();

    expect(suggestion.userId).toBe(userBId);
    expect(suggestion.source).toBe("partner");
    expect(suggestion.suggestedBy).toBe(userAId);
    expect(suggestion.status).toBe("suggested");

    createdWoundIds.push(suggestion.id);
  });

  it("should accept a suggestion by changing status to active", async () => {
    const [suggestion] = await db
      .insert(childhoodWounds)
      .values({
        userId: userBId,
        title: "Difficulty trusting others",
        source: "ai",
        status: "suggested",
      })
      .returning();
    createdWoundIds.push(suggestion.id);

    const [accepted] = await db
      .update(childhoodWounds)
      .set({ status: "active" })
      .where(
        and(
          eq(childhoodWounds.id, suggestion.id),
          eq(childhoodWounds.userId, userBId),
          eq(childhoodWounds.status, "suggested")
        )
      )
      .returning();

    expect(accepted.status).toBe("active");
  });

  it("should dismiss a suggestion by changing status to dismissed", async () => {
    const [suggestion] = await db
      .insert(childhoodWounds)
      .values({
        userId: userBId,
        title: "Fear of criticism",
        source: "partner",
        suggestedBy: userAId,
        status: "suggested",
      })
      .returning();
    createdWoundIds.push(suggestion.id);

    const [dismissed] = await db
      .update(childhoodWounds)
      .set({ status: "dismissed" })
      .where(
        and(
          eq(childhoodWounds.id, suggestion.id),
          eq(childhoodWounds.userId, userBId),
          eq(childhoodWounds.status, "suggested")
        )
      )
      .returning();

    expect(dismissed.status).toBe("dismissed");
  });

  it("should not accept/dismiss an already resolved suggestion", async () => {
    const [suggestion] = await db
      .insert(childhoodWounds)
      .values({
        userId: userBId,
        title: "Already resolved wound",
        source: "ai",
        status: "active", // already accepted
      })
      .returning();
    createdWoundIds.push(suggestion.id);

    // Try to dismiss an active wound via the suggestion path
    const result = await db
      .update(childhoodWounds)
      .set({ status: "dismissed" })
      .where(
        and(
          eq(childhoodWounds.id, suggestion.id),
          eq(childhoodWounds.userId, userBId),
          eq(childhoodWounds.status, "suggested") // won't match
        )
      )
      .returning();

    expect(result).toHaveLength(0);
  });

  // ── Edge Cases ──

  it("should handle special characters in title and description", async () => {
    const special = `Fear of "being seen" — 你好 🎭 <script>alert('xss')</script>`;
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: special,
        description: special,
      })
      .returning();

    expect(wound.title).toBe(special);
    expect(wound.description).toBe(special);
    createdWoundIds.push(wound.id);
  });

  it("should handle very long description", async () => {
    const longDesc = "This wound manifests as ".repeat(500);
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Long description test",
        description: longDesc,
      })
      .returning();

    expect(wound.description).toBe(longDesc);
    createdWoundIds.push(wound.id);
  });

  it("should support all source enum values", async () => {
    const sources = ["self", "partner", "ai"] as const;
    for (const src of sources) {
      const [wound] = await db
        .insert(childhoodWounds)
        .values({
          userId: userAId,
          title: `Source ${src} test`,
          source: src,
        })
        .returning();

      expect(wound.source).toBe(src);
      createdWoundIds.push(wound.id);
    }
  });

  it("should support all status enum values", async () => {
    const statuses = ["active", "suggested", "dismissed"] as const;
    for (const st of statuses) {
      const [wound] = await db
        .insert(childhoodWounds)
        .values({
          userId: userAId,
          title: `Status ${st} test`,
          status: st,
        })
        .returning();

      expect(wound.status).toBe(st);
      createdWoundIds.push(wound.id);
    }
  });

  // ── Intensity Edge Cases ──

  it("should default intensity to 5", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Default intensity test",
      })
      .returning();

    expect(wound.intensity).toBe(5);
    createdWoundIds.push(wound.id);
  });

  it("should store explicit intensity value", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "High intensity test",
        intensity: 9,
      })
      .returning();

    expect(wound.intensity).toBe(9);
    createdWoundIds.push(wound.id);
  });

  it("should accept boundary intensity values (1 and 10)", async () => {
    const [low] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Min intensity",
        intensity: 1,
      })
      .returning();

    const [high] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Max intensity",
        intensity: 10,
      })
      .returning();

    expect(low.intensity).toBe(1);
    expect(high.intensity).toBe(10);
    createdWoundIds.push(low.id, high.id);
  });

  it("should update intensity on an existing wound", async () => {
    const [wound] = await db
      .insert(childhoodWounds)
      .values({
        userId: userAId,
        title: "Update intensity test",
        intensity: 3,
      })
      .returning();
    createdWoundIds.push(wound.id);

    const [updated] = await db
      .update(childhoodWounds)
      .set({ intensity: 8 })
      .where(eq(childhoodWounds.id, wound.id))
      .returning();

    expect(updated.intensity).toBe(8);
  });

  it("should order wounds by intensity descending", async () => {
    // Create wounds with different intensities for user B
    const intensities = [2, 8, 5, 10, 1];
    for (const val of intensities) {
      const [w] = await db
        .insert(childhoodWounds)
        .values({
          userId: userBId,
          title: `Intensity ${val} sort test`,
          intensity: val,
          status: "active",
        })
        .returning();
      createdWoundIds.push(w.id);
    }

    const wounds = await db
      .select()
      .from(childhoodWounds)
      .where(eq(childhoodWounds.userId, userBId))
      .orderBy(desc(childhoodWounds.intensity), desc(childhoodWounds.createdAt));

    // Verify descending intensity order
    for (let i = 1; i < wounds.length; i++) {
      expect(wounds[i - 1].intensity).toBeGreaterThanOrEqual(wounds[i].intensity);
    }
  });

  it("should include intensity in suggestion workflow", async () => {
    const [suggestion] = await db
      .insert(childhoodWounds)
      .values({
        userId: userBId,
        title: "Intense suggestion",
        intensity: 7,
        source: "partner",
        suggestedBy: userAId,
        status: "suggested",
      })
      .returning();

    expect(suggestion.intensity).toBe(7);
    expect(suggestion.status).toBe("suggested");

    // Accept it and verify intensity persists
    const [accepted] = await db
      .update(childhoodWounds)
      .set({ status: "active" })
      .where(
        and(
          eq(childhoodWounds.id, suggestion.id),
          eq(childhoodWounds.userId, userBId),
          eq(childhoodWounds.status, "suggested")
        )
      )
      .returning();

    expect(accepted.intensity).toBe(7);
    expect(accepted.status).toBe("active");
    createdWoundIds.push(suggestion.id);
  });
});
