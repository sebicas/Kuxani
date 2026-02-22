/**
 * Intake Summary API — Aggregate all intake data for Phase 7 review
 *
 * GET /api/intake/summary — Returns structured summary of all completed phases
 *   including couple facts, both partners' dual-perspective answers,
 *   and individual data for the current user.
 */
import { NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user data
  const [userData] = await db
    .select({ name: user.name, profileData: user.profileData })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  // Get couple info
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);

  const coupleId = member?.coupleId;
  let partnerName: string | null = null;
  let partnerId: string | null = null;
  let partnerProfileData: typeof userData.profileData = null;

  if (coupleId) {
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
      partnerId = partner.userId;
      const [partnerUser] = await db
        .select({ name: user.name, profileData: user.profileData })
        .from(user)
        .where(eq(user.id, partner.userId))
        .limit(1);
      partnerName = partnerUser?.name || "Partner";
      partnerProfileData = partnerUser?.profileData;
    }
  }

  // Phase completion status
  const progressRows = await db
    .select()
    .from(intakeProgress)
    .where(eq(intakeProgress.userId, userId));

  const completedPhases = progressRows
    .filter((p) => p.status === "completed")
    .map((p) => p.phase);

  // Couple profile (Phase 1 facts)
  let coupleFacts = null;
  if (coupleId) {
    const [profile] = await db
      .select()
      .from(coupleProfiles)
      .where(eq(coupleProfiles.coupleId, coupleId))
      .limit(1);

    if (profile) {
      coupleFacts = {
        relationshipStage: profile.relationshipStage,
        togetherSince: profile.togetherSince,
        currentStageSince: profile.currentStageSince,
        livingSituation: profile.livingSituation,
        children: profile.children,
        therapyGoals: profile.therapyGoals,
        previousTherapy: profile.previousTherapy,
      };
    }
  }

  // Dual-perspective responses — both partners
  const myResponses: Record<number, Record<string, unknown>> = {};
  const partnerResponses: Record<number, Record<string, unknown>> = {};

  if (coupleId) {
    const myRows = await db
      .select()
      .from(intakeResponses)
      .where(
        and(
          eq(intakeResponses.userId, userId),
          eq(intakeResponses.coupleId, coupleId)
        )
      );

    for (const row of myRows) {
      if (!myResponses[row.phase]) myResponses[row.phase] = {};
      myResponses[row.phase][row.field] = row.value;
    }

    if (partnerId) {
      const partnerRows = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, partnerId),
            eq(intakeResponses.coupleId, coupleId)
          )
        );

      for (const row of partnerRows) {
        if (!partnerResponses[row.phase]) partnerResponses[row.phase] = {};
        partnerResponses[row.phase][row.field] = row.value;
      }
    }
  }

  // Individual data (Phases 3, 4, 6)
  const pd = userData?.profileData;
  const individualData = {
    familyOfOrigin: pd?.familyOfOrigin || null,
    attachmentHistory: pd?.attachmentHistory || null,
    externalStressors: pd?.externalStressors || null,
    mentalHealthContext: pd?.mentalHealthContext || null,
  };

  // Partner's individual data (for summary view)
  const partnerIndividualData = partnerProfileData
    ? {
        familyOfOrigin: partnerProfileData.familyOfOrigin || null,
        attachmentHistory: partnerProfileData.attachmentHistory || null,
        externalStressors: partnerProfileData.externalStressors || null,
        mentalHealthContext: partnerProfileData.mentalHealthContext || null,
      }
    : null;

  return NextResponse.json({
    userName: userData?.name || "You",
    partnerName,
    completedPhases,
    coupleFacts,
    myResponses,
    partnerResponses,
    individualData,
    partnerIndividualData,
  });
}
