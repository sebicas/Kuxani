/**
 * Intake Phase Data API — Save & Load Per-Phase Answers
 *
 * GET  /api/intake/phase/[phase] — Load phase data (with partner pre-fill for couple facts)
 * POST /api/intake/phase/[phase] — Save phase data to appropriate storage location
 *
 * Data Ownership:
 *   Phase 1 couple facts → couple_profiles (pre-filled for Partner B)
 *   Phase 2, 5 dual-perspective → intake_responses (per-user, no peeking)
 *   Phase 3, 4, 6 individual → user.profileData (own story)
 *   Phase 7 → read-only summary (no save needed)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  coupleProfiles,
  coupleMembers,
  intakeResponses,
  intakeProgress,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, ne } from "drizzle-orm";
import { extractChildhoodWounds } from "@/lib/ai/extract-wounds";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ phase: string }> };

/** Fields that belong to couple_profiles (Phase 1 couple facts) */
const COUPLE_FACT_FIELDS = [
  "relationshipStage",
  "togetherSince",
  "currentStageSince",
  "livingSituation",
  "children",
  "therapyGoals",
  "previousTherapy",
] as const;

/** Fields that go into user.profileData (individual phases 3, 4, 6) */
const _INDIVIDUAL_FIELDS = {
  3: "familyOfOrigin",
  4: "attachmentHistory",
  6: ["externalStressors", "mentalHealthContext"],
} as const;

/** Fields stored as dual-perspective intake_responses (phases 2, 5) */
const DUAL_PERSPECTIVE_FIELDS: Record<number, string[]> = {
  1: ["howMet", "initialAttraction"],
  2: ["presentingProblem", "biggestChallenges", "successVision"],
  5: [
    "typicalDisagreement",
    "pursuerWithdrawer",
    "repairStrategies",
    "relationshipStrengths",
  ],
  6: ["externalStressorsNarrative", "inLawDynamics"],
};

async function getUserCouple(userId: string) {
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return member?.coupleId || null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phase: phaseStr } = await context.params;
  const phase = parseInt(phaseStr, 10);
  if (isNaN(phase) || phase < 1 || phase > 7) {
    return NextResponse.json(
      { error: "Phase must be between 1 and 7" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const coupleId = await getUserCouple(userId);

  const result: Record<string, unknown> = { phase };

  // Phase 1: couple facts + dual-perspective narratives
  if (phase === 1) {
    if (coupleId) {
      const [profile] = await db
        .select()
        .from(coupleProfiles)
        .where(eq(coupleProfiles.coupleId, coupleId))
        .limit(1);

      if (profile) {
        result.coupleFacts = {
          relationshipStage: profile.relationshipStage,
          togetherSince: profile.togetherSince,
          currentStageSince: profile.currentStageSince,
          livingSituation: profile.livingSituation,
          children: profile.children,
          therapyGoals: profile.therapyGoals,
          previousTherapy: profile.previousTherapy,
        };
      }

      // Check if partner already filled this phase (for pre-fill banner)
      const [partner] = await db
        .select({ userId: coupleMembers.userId })
        .from(coupleMembers)
        .where(
          and(
            eq(coupleMembers.coupleId, coupleId),
            ne(coupleMembers.userId, userId)
          )
        )
        .limit(1);

      if (partner) {
        const [partnerProgress] = await db
          .select()
          .from(intakeProgress)
          .where(
            and(
              eq(intakeProgress.userId, partner.userId),
              eq(intakeProgress.phase, 1)
            )
          )
          .limit(1);
        result.partnerCompleted = partnerProgress?.status === "completed";
      }
    }

    // Load own dual-perspective answers for this phase
    if (coupleId) {
      const responses = await db
        .select({ field: intakeResponses.field, value: intakeResponses.value })
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, userId),
            eq(intakeResponses.coupleId, coupleId),
            eq(intakeResponses.phase, 1)
          )
        );
      result.responses = Object.fromEntries(
        responses.map((r) => [r.field, r.value])
      );
    }
  }

  // Phases 2, 5: dual-perspective only (own answers, no partner peeking)
  if (phase === 2 || phase === 5) {
    if (coupleId) {
      const responses = await db
        .select({ field: intakeResponses.field, value: intakeResponses.value })
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, userId),
            eq(intakeResponses.coupleId, coupleId),
            eq(intakeResponses.phase, phase)
          )
        );
      result.responses = Object.fromEntries(
        responses.map((r) => [r.field, r.value])
      );
    }
  }

  // Phases 3, 4, 6: individual data from user.profileData
  if (phase === 3 || phase === 4 || phase === 6) {
    const [userData] = await db
      .select({ profileData: user.profileData })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const pd = userData?.profileData;
    if (pd) {
      if (phase === 3) {
        result.individualData = pd.familyOfOrigin || {};
      } else if (phase === 4) {
        result.individualData = pd.attachmentHistory || {};
      } else if (phase === 6) {
        result.individualData = {
          externalStressors: pd.externalStressors || [],
          mentalHealthContext: pd.mentalHealthContext || "",
        };
        // Also load dual-perspective responses for phase 6
        if (coupleId) {
          const responses = await db
            .select({
              field: intakeResponses.field,
              value: intakeResponses.value,
            })
            .from(intakeResponses)
            .where(
              and(
                eq(intakeResponses.userId, userId),
                eq(intakeResponses.coupleId, coupleId),
                eq(intakeResponses.phase, 6)
              )
            );
          result.responses = Object.fromEntries(
            responses.map((r) => [r.field, r.value])
          );
        }
      }
    }
  }

  // Phase 7: read-only summary — delegate to /api/intake/summary
  if (phase === 7) {
    result.redirectToSummary = true;
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phase: phaseStr } = await context.params;
  const phase = parseInt(phaseStr, 10);
  if (isNaN(phase) || phase < 1 || phase > 7) {
    return NextResponse.json(
      { error: "Phase must be between 1 and 7" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const coupleId = await getUserCouple(userId);
  const body = await request.json();

  // Save couple facts (Phase 1)
  if (phase === 1 && body.coupleFacts && coupleId) {
    const facts = body.coupleFacts;
    const updateData: Record<string, unknown> = {};

    for (const field of COUPLE_FACT_FIELDS) {
      if (facts[field] !== undefined) {
        updateData[field] = facts[field];
      }
    }

    if (Object.keys(updateData).length > 0) {
      // Upsert couple profile
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
        await db.insert(coupleProfiles).values({
          coupleId,
          ...updateData,
        });
      }
    }
  }

  // Save dual-perspective responses
  const dualFields = DUAL_PERSPECTIVE_FIELDS[phase];
  if (dualFields && body.responses && coupleId) {
    for (const field of dualFields) {
      if (body.responses[field] !== undefined) {
        // Upsert response by (userId, coupleId, phase, field)
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
            .set({ value: body.responses[field] })
            .where(eq(intakeResponses.id, existing.id));
        } else {
          await db.insert(intakeResponses).values({
            userId,
            coupleId,
            phase,
            field,
            value: body.responses[field],
          });
        }
      }
    }
  }

  // Save individual data (Phases 3, 4, 6) → user.profileData
  if (body.individualData && (phase === 3 || phase === 4 || phase === 6)) {
    const [userData] = await db
      .select({ profileData: user.profileData })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const currentProfile = userData?.profileData || {};

    if (phase === 3) {
      currentProfile.familyOfOrigin = {
        ...currentProfile.familyOfOrigin,
        ...body.individualData,
      };
      // Fire-and-forget: analyze family data for childhood wounds
      if (currentProfile.familyOfOrigin) {
        extractChildhoodWounds(userId, currentProfile.familyOfOrigin).catch(
          () => {},
        );
      }
    } else if (phase === 4) {
      currentProfile.attachmentHistory = {
        ...currentProfile.attachmentHistory,
        ...body.individualData,
      };
    } else if (phase === 6) {
      if (body.individualData.externalStressors !== undefined) {
        currentProfile.externalStressors =
          body.individualData.externalStressors;
      }
      if (body.individualData.mentalHealthContext !== undefined) {
        currentProfile.mentalHealthContext =
          body.individualData.mentalHealthContext;
      }
    }

    await db
      .update(user)
      .set({ profileData: currentProfile })
      .where(eq(user.id, userId));
  }

  // Emit real-time event to partner
  if (coupleId) {
    try {
      const { getIO } = await import("@/lib/socket/socketServer");
      const { INTAKE_UPDATED } = await import("@/lib/socket/events");
      getIO().to(`couple:${coupleId}`).emit(INTAKE_UPDATED, {
        phase,
        action: "phase-data-saved",
        userId,
      });
    } catch {
      /* socket not available in test */
    }
  }

  return NextResponse.json({ success: true, phase });
}
