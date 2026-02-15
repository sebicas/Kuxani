/**
 * AI Context Loader
 *
 * Centralised functions that hydrate all AI Memory Tiers from the database
 * and return structured context ready for `buildSystemPrompt()`.
 *
 * Two entry-points:
 *   - loadCoupleContext(coupleId)   → couple-facing AI (challenges, synthesis, de-esc, gratitude)
 *   - loadPersonalContext(userId)   → private therapy chat
 */
import { db } from "@/lib/db";
import {
  user,
  coupleMembers,
  coupleProfiles,
  challengeSummaries,
  challenges,
  moodEntries,
  deescalationSessions,
  loveLanguageResults,
  attachmentStyleResults,
  childhoodWounds,
} from "@/lib/db/schema";
import { eq, desc, and, gte, inArray } from "drizzle-orm";

/* ──────────────────────────────────────────────────
   Shared types
   ────────────────────────────────────────────────── */

/** The shape returned by both loaders – every field is optional / spreadable. */
export interface AIContext {
  coupleProfile?: string;
  pastSummaries?: string[];
  personalProfile?: string;
  partnerProfiles?: string;
  childhoodWoundsContext?: string;
  attachmentContext?: string;
  moodContext?: string;
  deescalationContext?: string;
}

/* ──────────────────────────────────────────────────
   Couple-facing context
   ────────────────────────────────────────────────── */

export async function loadCoupleContext(coupleId: string): Promise<AIContext> {
  // 1. Couple profile
  const [profile] = await db
    .select()
    .from(coupleProfiles)
    .where(eq(coupleProfiles.coupleId, coupleId))
    .limit(1);

  // 2. Both members
  const members = await db
    .select({ userId: coupleMembers.userId })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, coupleId));
  const memberIds = members.map((m) => m.userId);

  // 3. Both members' user profile data
  const userProfiles =
    memberIds.length > 0
      ? await db
          .select({
            id: user.id,
            name: user.name,
            profileData: user.profileData,
          })
          .from(user)
          .where(inArray(user.id, memberIds))
      : [];

  // 4. Childhood wounds (active only)
  const wounds =
    memberIds.length > 0
      ? await db
          .select({
            userId: childhoodWounds.userId,
            title: childhoodWounds.title,
            intensity: childhoodWounds.intensity,
          })
          .from(childhoodWounds)
          .where(
            and(
              inArray(childhoodWounds.userId, memberIds),
              eq(childhoodWounds.status, "active")
            )
          )
      : [];

  // 5. Latest attachment style results per member
  const attachmentRows =
    memberIds.length > 0
      ? await db
          .select()
          .from(attachmentStyleResults)
          .where(inArray(attachmentStyleResults.userId, memberIds))
          .orderBy(desc(attachmentStyleResults.createdAt))
      : [];

  // 6. Latest love language results per member
  const llRows =
    memberIds.length > 0
      ? await db
          .select()
          .from(loveLanguageResults)
          .where(inArray(loveLanguageResults.userId, memberIds))
          .orderBy(desc(loveLanguageResults.createdAt))
      : [];

  // 7. Last 5 resolved challenge summaries for this couple
  const summaries = await db
    .select({
      topic: challengeSummaries.topic,
      recurringThemes: challengeSummaries.recurringThemes,
      commitmentsMade: challengeSummaries.commitmentsMade,
      attachmentDynamics: challengeSummaries.attachmentDynamics,
      growthAreas: challengeSummaries.growthAreas,
    })
    .from(challengeSummaries)
    .innerJoin(challenges, eq(challenges.id, challengeSummaries.challengeId))
    .where(eq(challenges.coupleId, coupleId))
    .orderBy(desc(challengeSummaries.createdAt))
    .limit(5);

  // 8. Recent mood entries (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const moods =
    memberIds.length > 0
      ? await db
          .select({
            userId: moodEntries.userId,
            primaryEmotion: moodEntries.primaryEmotion,
            intensity: moodEntries.intensity,
            createdAt: moodEntries.createdAt,
          })
          .from(moodEntries)
          .where(
            and(
              inArray(moodEntries.userId, memberIds),
              gte(moodEntries.createdAt, sevenDaysAgo)
            )
          )
          .orderBy(desc(moodEntries.createdAt))
          .limit(20)
      : [];

  // 9. Recent de-escalation sessions (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deescSessions = await db
    .select({
      triggerReason: deescalationSessions.triggerReason,
      reflection: deescalationSessions.reflection,
      createdAt: deescalationSessions.createdAt,
    })
    .from(deescalationSessions)
    .where(
      and(
        eq(deescalationSessions.coupleId, coupleId),
        gte(deescalationSessions.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(deescalationSessions.createdAt))
    .limit(5);

  // ── Format context strings ──
  return {
    coupleProfile: formatCoupleProfile(profile),
    pastSummaries: formatSummaries(summaries),
    partnerProfiles: formatPartnerProfiles(userProfiles, llRows, attachmentRows),
    childhoodWoundsContext: formatChildhoodWounds(wounds, userProfiles),
    attachmentContext: formatAttachmentStyles(attachmentRows, userProfiles),
    moodContext: formatMoodEntries(moods, userProfiles),
    deescalationContext: formatDeescalation(deescSessions),
  };
}

/* ──────────────────────────────────────────────────
   Personal-facing context
   ────────────────────────────────────────────────── */

export async function loadPersonalContext(
  userId: string
): Promise<AIContext> {
  // 1. User's profile data
  const [userData] = await db
    .select({
      id: user.id,
      name: user.name,
      profileData: user.profileData,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  // 2. Childhood wounds (active only)
  const wounds = await db
    .select({
      userId: childhoodWounds.userId,
      title: childhoodWounds.title,
      intensity: childhoodWounds.intensity,
    })
    .from(childhoodWounds)
    .where(
      and(
        eq(childhoodWounds.userId, userId),
        eq(childhoodWounds.status, "active")
      )
    );

  // 3. Latest attachment style results
  const [attachmentResult] = await db
    .select()
    .from(attachmentStyleResults)
    .where(eq(attachmentStyleResults.userId, userId))
    .orderBy(desc(attachmentStyleResults.createdAt))
    .limit(1);

  // 4. Latest love language results
  const [llResult] = await db
    .select()
    .from(loveLanguageResults)
    .where(eq(loveLanguageResults.userId, userId))
    .orderBy(desc(loveLanguageResults.createdAt))
    .limit(1);

  // 5. Recent mood entries (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const moods = await db
    .select({
      userId: moodEntries.userId,
      primaryEmotion: moodEntries.primaryEmotion,
      intensity: moodEntries.intensity,
      createdAt: moodEntries.createdAt,
    })
    .from(moodEntries)
    .where(
      and(
        eq(moodEntries.userId, userId),
        gte(moodEntries.createdAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(moodEntries.createdAt))
    .limit(10);

  // 6. De-escalation history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deescSessions = await db
    .select({
      triggerReason: deescalationSessions.triggerReason,
      reflection: deescalationSessions.reflection,
      createdAt: deescalationSessions.createdAt,
    })
    .from(deescalationSessions)
    .where(
      and(
        eq(deescalationSessions.userId, userId),
        gte(deescalationSessions.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(deescalationSessions.createdAt))
    .limit(5);

  // 7–8. Couple profile + summaries (if user is in a couple)
  let coupleProfile: string | undefined;
  let pastSummaries: string[] | undefined;

  const [membership] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);

  if (membership) {
    const [profile] = await db
      .select()
      .from(coupleProfiles)
      .where(eq(coupleProfiles.coupleId, membership.coupleId))
      .limit(1);

    coupleProfile = formatCoupleProfile(profile);

    const summaries = await db
      .select({
        topic: challengeSummaries.topic,
        recurringThemes: challengeSummaries.recurringThemes,
        commitmentsMade: challengeSummaries.commitmentsMade,
        attachmentDynamics: challengeSummaries.attachmentDynamics,
        growthAreas: challengeSummaries.growthAreas,
      })
      .from(challengeSummaries)
      .innerJoin(challenges, eq(challenges.id, challengeSummaries.challengeId))
      .where(eq(challenges.coupleId, membership.coupleId))
      .orderBy(desc(challengeSummaries.createdAt))
      .limit(5);

    pastSummaries = formatSummaries(summaries);
  }

  // ── Build personal profile string ──
  const profileParts: string[] = [];

  if (userData?.profileData) {
    const pd = userData.profileData;
    if (pd.attachmentStyle) profileParts.push(`Attachment style (self-reported): ${pd.attachmentStyle}`);
    if (pd.loveLanguage) profileParts.push(`Love language (self-reported): ${pd.loveLanguage}`);
    if (pd.triggers?.length) profileParts.push(`Known triggers: ${pd.triggers.join(", ")}`);
    if (pd.copingMechanisms?.length) profileParts.push(`Coping mechanisms: ${pd.copingMechanisms.join(", ")}`);
    if (pd.growthAreas?.length) profileParts.push(`Growth areas: ${pd.growthAreas.join(", ")}`);
  }

  if (llResult) {
    profileParts.push(
      `Love language quiz scores: Words ${llResult.wordsOfAffirmation}, Acts ${llResult.actsOfService}, Gifts ${llResult.receivingGifts}, Quality Time ${llResult.qualityTime}, Touch ${llResult.physicalTouch}`
    );
  }

  if (attachmentResult) {
    profileParts.push(
      `Attachment style quiz: Secure ${attachmentResult.secure}, Anxious ${attachmentResult.anxious}, Avoidant ${attachmentResult.avoidant}, Fearful-Avoidant ${attachmentResult.fearfulAvoidant}`
    );
  }

  const userProfiles = userData ? [userData] : [];
  const attachmentRows = attachmentResult ? [attachmentResult] : [];

  return {
    personalProfile: profileParts.length > 0 ? profileParts.join("\n") : undefined,
    coupleProfile,
    pastSummaries,
    childhoodWoundsContext: formatChildhoodWounds(wounds, userProfiles),
    moodContext: formatMoodEntries(moods, userProfiles),
    deescalationContext: formatDeescalation(deescSessions),
    attachmentContext: formatAttachmentStyles(attachmentRows, userProfiles),
  };
}

/* ──────────────────────────────────────────────────
   Formatting helpers (token-efficient, no raw JSON)
   ────────────────────────────────────────────────── */

interface ProfileRow {
  id: string;
  name: string | null;
  profileData: {
    attachmentStyle?: string;
    triggers?: string[];
    copingMechanisms?: string[];
    growthAreas?: string[];
    loveLanguage?: string;
  } | null;
}

function nameFor(profiles: ProfileRow[], userId: string): string {
  return profiles.find((p) => p.id === userId)?.name || "Partner";
}

function formatCoupleProfile(
  profile: typeof coupleProfiles.$inferSelect | undefined
): string | undefined {
  if (!profile) return undefined;
  const parts: string[] = [];
  if (profile.communicationPatterns)
    parts.push(`Communication patterns: ${JSON.stringify(profile.communicationPatterns)}`);
  if (profile.commonTriggers)
    parts.push(`Common triggers: ${JSON.stringify(profile.commonTriggers)}`);
  if (profile.loveLanguages)
    parts.push(`Love languages: ${JSON.stringify(profile.loveLanguages)}`);
  if (profile.effectiveStrategies)
    parts.push(`Effective strategies: ${JSON.stringify(profile.effectiveStrategies)}`);
  if (profile.recentWins)
    parts.push(`Recent wins: ${JSON.stringify(profile.recentWins)}`);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function formatSummaries(
  summaries: {
    topic: string | null;
    recurringThemes: string[] | null;
    commitmentsMade: unknown;
    attachmentDynamics: unknown;
    growthAreas: string[] | null;
  }[]
): string[] | undefined {
  if (!summaries.length) return undefined;
  return summaries.map((s) => {
    const lines: string[] = [];
    if (s.topic) lines.push(`Topic: ${s.topic}`);
    if (s.recurringThemes?.length) lines.push(`Themes: ${s.recurringThemes.join(", ")}`);
    if (s.commitmentsMade) lines.push(`Commitments: ${JSON.stringify(s.commitmentsMade)}`);
    if (s.attachmentDynamics) lines.push(`Attachment dynamics: ${JSON.stringify(s.attachmentDynamics)}`);
    if (s.growthAreas?.length) lines.push(`Growth areas: ${s.growthAreas.join(", ")}`);
    return lines.join("\n");
  });
}

function formatPartnerProfiles(
  profiles: ProfileRow[],
  llRows: (typeof loveLanguageResults.$inferSelect)[],
  attachmentRows: (typeof attachmentStyleResults.$inferSelect)[]
): string | undefined {
  if (!profiles.length) return undefined;
  const seen = new Set<string>();
  const parts = profiles.map((p) => {
    const lines: string[] = [`${p.name || "Partner"}:`];
    const pd = p.profileData;
    if (pd) {
      if (pd.triggers?.length) lines.push(`  Triggers: ${pd.triggers.join(", ")}`);
      if (pd.copingMechanisms?.length) lines.push(`  Coping: ${pd.copingMechanisms.join(", ")}`);
      if (pd.growthAreas?.length) lines.push(`  Growth: ${pd.growthAreas.join(", ")}`);
    }
    // Latest love language for this user (first unseen)
    const ll = llRows.find((r) => r.userId === p.id && !seen.has(r.id));
    if (ll) {
      seen.add(ll.id);
      lines.push(
        `  Love languages: Words ${ll.wordsOfAffirmation}, Acts ${ll.actsOfService}, Gifts ${ll.receivingGifts}, Quality ${ll.qualityTime}, Touch ${ll.physicalTouch}`
      );
    }
    // Latest attachment for this user
    const att = attachmentRows.find((r) => r.userId === p.id && !seen.has(r.id));
    if (att) {
      seen.add(att.id);
      lines.push(
        `  Attachment: Secure ${att.secure}, Anxious ${att.anxious}, Avoidant ${att.avoidant}, Fearful ${att.fearfulAvoidant}`
      );
    }
    return lines.join("\n");
  });
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function formatChildhoodWounds(
  wounds: { userId: string; title: string; intensity: number }[],
  profiles: ProfileRow[]
): string | undefined {
  if (!wounds.length) return undefined;
  const lines = wounds.map(
    (w) => `- ${nameFor(profiles, w.userId)}: "${w.title}" (intensity ${w.intensity}/10)`
  );
  return lines.join("\n");
}

function formatAttachmentStyles(
  rows: (typeof attachmentStyleResults.$inferSelect)[],
  profiles: ProfileRow[]
): string | undefined {
  if (!rows.length) return undefined;
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    lines.push(
      `${nameFor(profiles, r.userId)}: Secure ${r.secure}, Anxious ${r.anxious}, Avoidant ${r.avoidant}, Fearful-Avoidant ${r.fearfulAvoidant}`
    );
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

function formatMoodEntries(
  moods: {
    userId: string;
    primaryEmotion: string;
    intensity: number;
    createdAt: Date;
  }[],
  profiles: ProfileRow[]
): string | undefined {
  if (!moods.length) return undefined;
  const lines = moods.map(
    (m) =>
      `${nameFor(profiles, m.userId)} — ${m.primaryEmotion} (${m.intensity}/10) on ${m.createdAt.toLocaleDateString()}`
  );
  return lines.join("\n");
}

function formatDeescalation(
  sessions: {
    triggerReason: string | null;
    reflection: string | null;
    createdAt: Date;
  }[]
): string | undefined {
  if (!sessions.length) return undefined;
  const lines = sessions.map((s) => {
    const parts: string[] = [];
    if (s.triggerReason) parts.push(`Trigger: ${s.triggerReason}`);
    if (s.reflection) parts.push(`Reflection: ${s.reflection}`);
    parts.push(`Date: ${s.createdAt.toLocaleDateString()}`);
    return parts.join(" | ");
  });
  return lines.join("\n");
}
