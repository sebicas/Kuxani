/**
 * Intake Data Saver — Shared logic for saving extracted intake_data blocks
 *
 * Used by both /api/intake/chat and /api/personal/chats/[id]/messages
 * when conducting intake interviews through the personal chat.
 */
import { db } from "@/lib/db";
import {
  coupleProfiles,
  coupleMembers,
  intakeResponses,
  intakeProgress,
  user,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractChildhoodWounds } from "@/lib/ai/extract-wounds";

/* ── Field classification ── */

const COUPLE_FACT_FIELDS = new Set([
  "relationshipStage",
  "togetherSince",
  "livingSituation",
  "children",
  "therapyGoals",
]);

const RESPONSE_FIELDS = new Set([
  "howMet",
  "initialAttraction",
  "presentingProblem",
  "biggestChallenges",
  "successVision",
  "typicalDisagreement",
  "pursuerWithdrawer",
  "repairStrategies",
  "relationshipStrengths",
  "inLawDynamics",
]);

const INDIVIDUAL_FIELDS = new Set([
  "parentsRelationship",
  "familyConflictStyle",
  "emotionalEnvironment",
  "familyRole",
  "unspokenRules",
  "significantLosses",
  "culturalContext",
  "childhoodComfortSource",
  "wasComfortAvailable",
  "selfSoothingPatterns",
  "previousRelationships",
  "vulnerabilityComfort",
  "externalStressors",
  "mentalHealthContext",
]);

const FAMILY_OF_ORIGIN_FIELDS = new Set([
  "parentsRelationship",
  "familyConflictStyle",
  "emotionalEnvironment",
  "familyRole",
  "unspokenRules",
  "significantLosses",
  "culturalContext",
]);

const ATTACHMENT_HISTORY_FIELDS = new Set([
  "childhoodComfortSource",
  "wasComfortAvailable",
  "selfSoothingPatterns",
  "previousRelationships",
  "vulnerabilityComfort",
]);

const RESPONSE_FIELD_PHASE: Record<string, number> = {
  howMet: 1,
  initialAttraction: 1,
  presentingProblem: 2,
  biggestChallenges: 2,
  successVision: 2,
  typicalDisagreement: 5,
  pursuerWithdrawer: 5,
  repairStrategies: 5,
  relationshipStrengths: 5,
  inLawDynamics: 6,
};

/* ── Helpers ── */

async function getUserCouple(userId: string): Promise<string | null> {
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return member?.coupleId || null;
}

/* ── Main saver ── */

/**
 * Save extracted intake data from a chat response to the appropriate DB tables.
 */
export async function saveIntakeDataFromChat(
  userId: string,
  data: Record<string, unknown>
) {
  const coupleId = await getUserCouple(userId);

  // Save couple facts → couple_profiles
  if (data.coupleFacts && coupleId) {
    const updateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      data.coupleFacts as Record<string, unknown>
    )) {
      if (COUPLE_FACT_FIELDS.has(key) && val !== undefined) {
        updateData[key] = val;
      }
    }

    if (Object.keys(updateData).length > 0) {
      const [existing] = await db
        .select()
        .from(coupleProfiles)
        .where(eq(coupleProfiles.coupleId, coupleId))
        .limit(1);

      if (existing) {
        await db
          .update(coupleProfiles)
          .set(updateData)
          .where(eq(coupleProfiles.coupleId, coupleId));
      } else {
        await db.insert(coupleProfiles).values({ coupleId, ...updateData });
      }
    }
  }

  // Save dual-perspective responses → intake_responses
  if (data.responses && coupleId) {
    for (const [field, value] of Object.entries(
      data.responses as Record<string, unknown>
    )) {
      if (!RESPONSE_FIELDS.has(field) || value === undefined) continue;
      const phase =
        RESPONSE_FIELD_PHASE[field] || (data.phase as number) || 1;

      const [existing] = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, userId),
            eq(intakeResponses.coupleId, coupleId),
            eq(intakeResponses.phase, phase),
            eq(intakeResponses.field, field)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(intakeResponses)
          .set({ value })
          .where(eq(intakeResponses.id, existing.id));
      } else {
        await db
          .insert(intakeResponses)
          .values({ userId, coupleId, phase, field, value });
      }
    }
  }

  // Save individual data → user.profileData
  if (data.individualData) {
    const [userData] = await db
      .select({ profileData: user.profileData })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentProfile: any = userData?.profileData || {};
    let changed = false;

    const familyUpdates: Record<string, unknown> = {};
    const attachmentUpdates: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(
      data.individualData as Record<string, unknown>
    )) {
      if (!INDIVIDUAL_FIELDS.has(key) || val === undefined) continue;

      if (FAMILY_OF_ORIGIN_FIELDS.has(key)) {
        familyUpdates[key] = val;
      } else if (ATTACHMENT_HISTORY_FIELDS.has(key)) {
        attachmentUpdates[key] = val;
      } else if (key === "externalStressors") {
        currentProfile.externalStressors = val as string[];
        changed = true;
      } else if (key === "mentalHealthContext") {
        currentProfile.mentalHealthContext = val as string;
        changed = true;
      }
    }

    if (Object.keys(familyUpdates).length > 0) {
      currentProfile.familyOfOrigin = {
        ...currentProfile.familyOfOrigin,
        ...familyUpdates,
      };
      changed = true;

      // Fire-and-forget: extract childhood wounds from family data
      extractChildhoodWounds(userId, currentProfile.familyOfOrigin).catch(
        () => {}
      );
    }

    if (Object.keys(attachmentUpdates).length > 0) {
      currentProfile.attachmentHistory = {
        ...currentProfile.attachmentHistory,
        ...attachmentUpdates,
      };
      changed = true;
    }

    if (changed) {
      await db
        .update(user)
        .set({ profileData: currentProfile })
        .where(eq(user.id, userId));
    }
  }

  // Mark phase progress
  const coupleIdForProgress = coupleId;
  if (data.phase) {
    const [existing] = await db
      .select()
      .from(intakeProgress)
      .where(
        and(
          eq(intakeProgress.userId, userId),
          eq(intakeProgress.phase, data.phase as number)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(intakeProgress)
        .set({
          status: data.complete ? "completed" : "in_progress",
          modalityUsed: "chat",
          completedAt: data.complete ? new Date() : null,
        })
        .where(eq(intakeProgress.id, existing.id));
    } else {
      await db.insert(intakeProgress).values({
        userId,
        coupleId: coupleIdForProgress,
        phase: data.phase as number,
        status: data.complete ? "completed" : "in_progress",
        modalityUsed: "chat",
        startedAt: new Date(),
        completedAt: data.complete ? new Date() : null,
      });
    }
  }
}
