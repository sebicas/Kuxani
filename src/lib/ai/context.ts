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
  gratitudeEntries,
  deescalationSessions,
  loveLanguageResults,
  attachmentStyleResults,
  childhoodWounds,
  intakeResponses,
} from "@/lib/db/schema";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import {
  LOVE_LANGUAGE_NAMES,
  LOVE_LANGUAGE_DESCRIPTIONS,
  type LoveLanguageKey,
} from "@/lib/data/love-languages";
import {
  ATTACHMENT_STYLE_NAMES,
  ATTACHMENT_STYLE_DESCRIPTIONS,
  type AttachmentStyleKey,
} from "@/lib/data/attachment-styles";

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
  gratitudeContext?: string;
  loveLanguageContext?: string;
  intakeContext?: string;
}

/* ──────────────────────────────────────────────────
   Time boundaries (shared)
   ────────────────────────────────────────────────── */

function getTimeBoundaries() {
  const now = Date.now();
  return {
    twentyFourHoursAgo: new Date(now - 24 * 60 * 60 * 1000),
    sevenDaysAgo: new Date(now - 7 * 24 * 60 * 60 * 1000),
    thirtyDaysAgo: new Date(now - 30 * 24 * 60 * 60 * 1000),
  };
}

/* ──────────────────────────────────────────────────
   Couple-facing context
   ────────────────────────────────────────────────── */

export async function loadCoupleContext(coupleId: string): Promise<AIContext> {
  const { sevenDaysAgo, thirtyDaysAgo } = getTimeBoundaries();

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

  // 4. Childhood wounds (active only) — full description
  const wounds =
    memberIds.length > 0
      ? await db
          .select({
            userId: childhoodWounds.userId,
            title: childhoodWounds.title,
            description: childhoodWounds.description,
            intensity: childhoodWounds.intensity,
          })
          .from(childhoodWounds)
          .where(
            and(
              inArray(childhoodWounds.userId, memberIds),
              eq(childhoodWounds.status, "active"),
            ),
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

  // 8. Recent mood entries (last 7 days) — full details
  const moods =
    memberIds.length > 0
      ? await db
          .select({
            userId: moodEntries.userId,
            primaryEmotion: moodEntries.primaryEmotion,
            secondaryEmotion: moodEntries.secondaryEmotion,
            intensity: moodEntries.intensity,
            notes: moodEntries.notes,
            sharedWithPartner: moodEntries.sharedWithPartner,
            createdAt: moodEntries.createdAt,
          })
          .from(moodEntries)
          .where(
            and(
              inArray(moodEntries.userId, memberIds),
              gte(moodEntries.createdAt, sevenDaysAgo),
            ),
          )
          .orderBy(desc(moodEntries.createdAt))
          .limit(20)
      : [];

  // 9. Recent de-escalation sessions (last 30 days)
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
        gte(deescalationSessions.createdAt, thirtyDaysAgo),
      ),
    )
    .orderBy(desc(deescalationSessions.createdAt))
    .limit(5);

  // 10. Gratitude entries (last 30 days)
  const gratitude =
    memberIds.length > 0
      ? await db
          .select({
            userId: gratitudeEntries.userId,
            content: gratitudeEntries.content,
            category: gratitudeEntries.category,
            shared: gratitudeEntries.shared,
            createdAt: gratitudeEntries.createdAt,
          })
          .from(gratitudeEntries)
          .where(
            and(
              inArray(gratitudeEntries.userId, memberIds),
              gte(gratitudeEntries.createdAt, thirtyDaysAgo),
            ),
          )
          .orderBy(desc(gratitudeEntries.createdAt))
          .limit(20)
      : [];

  // ── Intake data ──
  const intakeCtx = await formatIntakeContext(coupleId, memberIds, userProfiles);

  // ── Format context strings ──
  return {
    coupleProfile: formatCoupleProfile(profile),
    pastSummaries: formatSummaries(summaries),
    partnerProfiles: formatPartnerProfiles(
      userProfiles,
      llRows,
      attachmentRows,
    ),
    childhoodWoundsContext: formatChildhoodWounds(wounds, userProfiles),
    attachmentContext: formatAttachmentStyles(attachmentRows, userProfiles),
    moodContext: formatMoodEntries(moods, userProfiles),
    deescalationContext: formatDeescalation(deescSessions),
    gratitudeContext: formatGratitudeEntries(gratitude, userProfiles),
    loveLanguageContext: formatLoveLanguages(llRows, userProfiles),
    intakeContext: intakeCtx,
  };
}

/* ──────────────────────────────────────────────────
   Personal-facing context
   ────────────────────────────────────────────────── */

export async function loadPersonalContext(userId: string): Promise<AIContext> {
  const { sevenDaysAgo, thirtyDaysAgo } = getTimeBoundaries();

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

  // 2. Childhood wounds (active only) — full description
  const wounds = await db
    .select({
      userId: childhoodWounds.userId,
      title: childhoodWounds.title,
      description: childhoodWounds.description,
      intensity: childhoodWounds.intensity,
    })
    .from(childhoodWounds)
    .where(
      and(
        eq(childhoodWounds.userId, userId),
        eq(childhoodWounds.status, "active"),
      ),
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

  // 5. Recent mood entries (last 7 days) — full details
  const moods = await db
    .select({
      userId: moodEntries.userId,
      primaryEmotion: moodEntries.primaryEmotion,
      secondaryEmotion: moodEntries.secondaryEmotion,
      intensity: moodEntries.intensity,
      notes: moodEntries.notes,
      sharedWithPartner: moodEntries.sharedWithPartner,
      createdAt: moodEntries.createdAt,
    })
    .from(moodEntries)
    .where(
      and(
        eq(moodEntries.userId, userId),
        gte(moodEntries.createdAt, sevenDaysAgo),
      ),
    )
    .orderBy(desc(moodEntries.createdAt))
    .limit(10);

  // 6. De-escalation history
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
        gte(deescalationSessions.createdAt, thirtyDaysAgo),
      ),
    )
    .orderBy(desc(deescalationSessions.createdAt))
    .limit(5);

  // 7. Gratitude entries (last 30 days)
  const gratitude = await db
    .select({
      userId: gratitudeEntries.userId,
      content: gratitudeEntries.content,
      category: gratitudeEntries.category,
      shared: gratitudeEntries.shared,
      createdAt: gratitudeEntries.createdAt,
    })
    .from(gratitudeEntries)
    .where(
      and(
        eq(gratitudeEntries.userId, userId),
        gte(gratitudeEntries.createdAt, thirtyDaysAgo),
      ),
    )
    .orderBy(desc(gratitudeEntries.createdAt))
    .limit(10);

  // 8–9. Couple profile + summaries (if user is in a couple)
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
    if (pd.attachmentStyle)
      profileParts.push(
        `Attachment style (self-reported): ${pd.attachmentStyle}`,
      );
    if (pd.loveLanguage)
      profileParts.push(`Love language (self-reported): ${pd.loveLanguage}`);
    if (pd.triggers?.length)
      profileParts.push(`Known triggers: ${pd.triggers.join(", ")}`);
    if (pd.copingMechanisms?.length)
      profileParts.push(`Coping mechanisms: ${pd.copingMechanisms.join(", ")}`);
    if (pd.growthAreas?.length)
      profileParts.push(`Growth areas: ${pd.growthAreas.join(", ")}`);
  }

  if (llResult) {
    const dominant = getDominantLoveLanguage(llResult);
    profileParts.push(
      `Love language quiz scores: Words ${llResult.wordsOfAffirmation}, Acts ${llResult.actsOfService}, Gifts ${llResult.receivingGifts}, Quality Time ${llResult.qualityTime}, Touch ${llResult.physicalTouch}`,
    );
    if (dominant) {
      profileParts.push(
        `Dominant love language: ${LOVE_LANGUAGE_NAMES[dominant]} — ${LOVE_LANGUAGE_DESCRIPTIONS[dominant]}`,
      );
    }
  }

  if (attachmentResult) {
    const dominant = getDominantAttachmentStyle(attachmentResult);
    profileParts.push(
      `Attachment style quiz: Secure ${attachmentResult.secure}, Anxious ${attachmentResult.anxious}, Avoidant ${attachmentResult.avoidant}, Fearful-Avoidant ${attachmentResult.fearfulAvoidant}`,
    );
    if (dominant) {
      profileParts.push(
        `Dominant attachment style: ${ATTACHMENT_STYLE_NAMES[dominant]} — ${ATTACHMENT_STYLE_DESCRIPTIONS[dominant]}`,
      );
    }
  }

  const userProfiles = userData ? [userData] : [];
  const attachmentRows = attachmentResult ? [attachmentResult] : [];
  const llRows = llResult ? [llResult] : [];

  // ── Intake data ──
  let intakeCtx: string | undefined;
  if (membership) {
    const memberIds = [userId];
    intakeCtx = await formatIntakeContext(membership.coupleId, memberIds, userProfiles);
  } else {
    // Solo user — load individual intake data from profileData
    const pd = userData?.profileData;
    if (pd?.familyOfOrigin || pd?.attachmentHistory || pd?.externalStressors || pd?.mentalHealthContext) {
      const parts: string[] = [];
      if (pd.familyOfOrigin) {
        const fo = pd.familyOfOrigin;
        const foLines: string[] = [];
        if (fo.parentsRelationship) foLines.push(`Parents' relationship: ${fo.parentsRelationship}`);
        if (fo.familyConflictStyle) foLines.push(`Family conflict style: ${fo.familyConflictStyle}`);
        if (fo.emotionalEnvironment) foLines.push(`Emotional environment: ${fo.emotionalEnvironment}`);
        if (fo.familyRole) foLines.push(`Family role: ${fo.familyRole}`);
        if (fo.unspokenRules?.length) foLines.push(`Unspoken rules: ${fo.unspokenRules.join(", ")}`);
        if (fo.culturalContext) foLines.push(`Cultural context: ${fo.culturalContext}`);
        if (foLines.length) parts.push(`Family of Origin:\n${foLines.join("\n")}`);
      }
      if (pd.attachmentHistory) {
        const ah = pd.attachmentHistory;
        const ahLines: string[] = [];
        if (ah.childhoodComfortSource) ahLines.push(`Comfort source: ${ah.childhoodComfortSource}`);
        if (ah.wasComfortAvailable !== undefined) ahLines.push(`Comfort available: ${ah.wasComfortAvailable ? "Yes" : "No"}`);
        if (ah.selfSoothingPatterns?.length) ahLines.push(`Self-soothing: ${ah.selfSoothingPatterns.join(", ")}`);
        if (ah.vulnerabilityComfort) ahLines.push(`Vulnerability comfort: ${ah.vulnerabilityComfort}`);
        if (ahLines.length) parts.push(`Attachment History:\n${ahLines.join("\n")}`);
      }
      if (pd.externalStressors?.length) parts.push(`External stressors: ${pd.externalStressors.join(", ")}`);
      if (pd.mentalHealthContext) parts.push(`Mental health context: ${pd.mentalHealthContext}`);
      intakeCtx = parts.join("\n\n");
    }
  }

  return {
    personalProfile:
      profileParts.length > 0 ? profileParts.join("\n") : undefined,
    coupleProfile,
    pastSummaries,
    childhoodWoundsContext: formatChildhoodWounds(wounds, userProfiles),
    moodContext: formatMoodEntries(moods, userProfiles),
    deescalationContext: formatDeescalation(deescSessions),
    attachmentContext: formatAttachmentStyles(attachmentRows, userProfiles),
    gratitudeContext: formatGratitudeEntries(gratitude, userProfiles),
    loveLanguageContext: formatLoveLanguages(llRows, userProfiles),
    intakeContext: intakeCtx,
  };
}

/* ──────────────────────────────────────────────────
   Formatting helpers (token-efficient, no raw JSON)
   ────────────────────────────────────────────────── */

export interface ProfileRow {
  id: string;
  name: string | null;
  profileData: {
    attachmentStyle?: string;
    triggers?: string[];
    copingMechanisms?: string[];
    growthAreas?: string[];
    loveLanguage?: string;
    familyOfOrigin?: {
      parentsRelationship?: string;
      familyConflictStyle?: string;
      emotionalEnvironment?: string;
      familyRole?: string;
      unspokenRules?: string[];
      significantLosses?: string[];
      culturalContext?: string;
    };
    attachmentHistory?: {
      childhoodComfortSource?: string;
      wasComfortAvailable?: boolean;
      selfSoothingPatterns?: string[];
      previousRelationships?: string;
      vulnerabilityComfort?: string;
    };
    externalStressors?: string[];
    mentalHealthContext?: string;
  } | null;
}

export function nameFor(profiles: ProfileRow[], userId: string): string {
  return profiles.find((p) => p.id === userId)?.name || "Partner";
}

/** Returns ⚡ RECENT prefix for items within the last 24 hours */
export function recencyTag(createdAt: Date): string {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  return createdAt.getTime() > twentyFourHoursAgo ? "⚡ RECENT — " : "";
}

export function formatCoupleProfile(
  profile: typeof coupleProfiles.$inferSelect | undefined,
): string | undefined {
  if (!profile) return undefined;
  const parts: string[] = [];
  if (profile.communicationPatterns)
    parts.push(
      `Communication patterns: ${JSON.stringify(profile.communicationPatterns)}`,
    );
  if (profile.commonTriggers)
    parts.push(`Common triggers: ${JSON.stringify(profile.commonTriggers)}`);
  if (profile.loveLanguages)
    parts.push(`Love languages: ${JSON.stringify(profile.loveLanguages)}`);
  if (profile.effectiveStrategies)
    parts.push(
      `Effective strategies: ${JSON.stringify(profile.effectiveStrategies)}`,
    );
  if (profile.recentWins)
    parts.push(`Recent wins: ${JSON.stringify(profile.recentWins)}`);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

export function formatSummaries(
  summaries: {
    topic: string | null;
    recurringThemes: string[] | null;
    commitmentsMade: unknown;
    attachmentDynamics: unknown;
    growthAreas: string[] | null;
  }[],
): string[] | undefined {
  if (!summaries.length) return undefined;
  return summaries.map((s) => {
    const lines: string[] = [];
    if (s.topic) lines.push(`Topic: ${s.topic}`);
    if (s.recurringThemes?.length)
      lines.push(`Themes: ${s.recurringThemes.join(", ")}`);
    if (s.commitmentsMade)
      lines.push(`Commitments: ${JSON.stringify(s.commitmentsMade)}`);
    if (s.attachmentDynamics)
      lines.push(
        `Attachment dynamics: ${JSON.stringify(s.attachmentDynamics)}`,
      );
    if (s.growthAreas?.length)
      lines.push(`Growth areas: ${s.growthAreas.join(", ")}`);
    return lines.join("\n");
  });
}

export function formatPartnerProfiles(
  profiles: ProfileRow[],
  llRows: (typeof loveLanguageResults.$inferSelect)[],
  attachmentRows: (typeof attachmentStyleResults.$inferSelect)[],
): string | undefined {
  if (!profiles.length) return undefined;
  const seen = new Set<string>();
  const parts = profiles.map((p) => {
    const lines: string[] = [`${p.name || "Partner"}:`];
    const pd = p.profileData;
    if (pd) {
      if (pd.triggers?.length)
        lines.push(`  Triggers: ${pd.triggers.join(", ")}`);
      if (pd.copingMechanisms?.length)
        lines.push(`  Coping: ${pd.copingMechanisms.join(", ")}`);
      if (pd.growthAreas?.length)
        lines.push(`  Growth: ${pd.growthAreas.join(", ")}`);
    }
    // Latest love language for this user (first unseen)
    const ll = llRows.find((r) => r.userId === p.id && !seen.has(r.id));
    if (ll) {
      seen.add(ll.id);
      const dominant = getDominantLoveLanguage(ll);
      lines.push(
        `  Love languages: Words ${ll.wordsOfAffirmation}, Acts ${ll.actsOfService}, Gifts ${ll.receivingGifts}, Quality ${ll.qualityTime}, Touch ${ll.physicalTouch}`,
      );
      if (dominant) {
        lines.push(
          `  Dominant: ${LOVE_LANGUAGE_NAMES[dominant]} — ${LOVE_LANGUAGE_DESCRIPTIONS[dominant]}`,
        );
      }
    }
    // Latest attachment for this user
    const att = attachmentRows.find(
      (r) => r.userId === p.id && !seen.has(r.id),
    );
    if (att) {
      seen.add(att.id);
      const dominant = getDominantAttachmentStyle(att);
      lines.push(
        `  Attachment: Secure ${att.secure}, Anxious ${att.anxious}, Avoidant ${att.avoidant}, Fearful ${att.fearfulAvoidant}`,
      );
      if (dominant) {
        lines.push(
          `  Dominant: ${ATTACHMENT_STYLE_NAMES[dominant]} — ${ATTACHMENT_STYLE_DESCRIPTIONS[dominant]}`,
        );
      }
    }
    return lines.join("\n");
  });
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function formatChildhoodWounds(
  wounds: {
    userId: string;
    title: string;
    description: string | null;
    intensity: number;
  }[],
  profiles: ProfileRow[],
): string | undefined {
  if (!wounds.length) return undefined;
  const lines = wounds.map((w) => {
    const desc = w.description ? ` — ${w.description}` : "";
    return `- ${nameFor(profiles, w.userId)}: "${w.title}" (intensity ${w.intensity}/10)${desc}`;
  });
  return lines.join("\n");
}

export function formatAttachmentStyles(
  rows: (typeof attachmentStyleResults.$inferSelect)[],
  profiles: ProfileRow[],
): string | undefined {
  if (!rows.length) return undefined;
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    const dominant = getDominantAttachmentStyle(r);
    let line = `${nameFor(profiles, r.userId)}: Secure ${r.secure}, Anxious ${r.anxious}, Avoidant ${r.avoidant}, Fearful-Avoidant ${r.fearfulAvoidant}`;
    if (dominant) {
      line += `\n  Dominant: ${ATTACHMENT_STYLE_NAMES[dominant]} — ${ATTACHMENT_STYLE_DESCRIPTIONS[dominant]}`;
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function formatMoodEntries(
  moods: {
    userId: string;
    primaryEmotion: string;
    secondaryEmotion: string | null;
    intensity: number;
    notes: string | null;
    sharedWithPartner: boolean;
    createdAt: Date;
  }[],
  profiles: ProfileRow[],
): string | undefined {
  if (!moods.length) return undefined;
  const lines = moods.map((m) => {
    const tag = recencyTag(m.createdAt);
    const secondary = m.secondaryEmotion ? ` + ${m.secondaryEmotion}` : "";
    const notes = m.notes ? ` — "${m.notes}"` : "";
    const shared = m.sharedWithPartner ? " [shared]" : "";
    return `${tag}${nameFor(profiles, m.userId)} — ${m.primaryEmotion}${secondary} (${m.intensity}/10) on ${m.createdAt.toLocaleDateString()}${notes}${shared}`;
  });
  return lines.join("\n");
}

export function formatDeescalation(
  sessions: {
    triggerReason: string | null;
    reflection: string | null;
    createdAt: Date;
  }[],
): string | undefined {
  if (!sessions.length) return undefined;
  const lines = sessions.map((s) => {
    const tag = recencyTag(s.createdAt);
    const parts: string[] = [];
    if (s.triggerReason) parts.push(`Trigger: ${s.triggerReason}`);
    if (s.reflection) parts.push(`Reflection: ${s.reflection}`);
    parts.push(`Date: ${s.createdAt.toLocaleDateString()}`);
    return `${tag}${parts.join(" | ")}`;
  });
  return lines.join("\n");
}

export function formatGratitudeEntries(
  entries: {
    userId: string;
    content: string;
    category: string;
    shared: boolean;
    createdAt: Date;
  }[],
  profiles: ProfileRow[],
): string | undefined {
  if (!entries.length) return undefined;
  const lines = entries.map((e) => {
    const tag = recencyTag(e.createdAt);
    const shared = e.shared ? " [shared with partner]" : "";
    const cat =
      e.category !== "gratitude" ? ` (${e.category.replace("_", " ")})` : "";
    return `${tag}${nameFor(profiles, e.userId)}${cat}: "${e.content}" — ${e.createdAt.toLocaleDateString()}${shared}`;
  });
  return lines.join("\n");
}

export function formatLoveLanguages(
  rows: (typeof loveLanguageResults.$inferSelect)[],
  profiles: ProfileRow[],
): string | undefined {
  if (!rows.length) return undefined;
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    const dominant = getDominantLoveLanguage(r);
    let line = `${nameFor(profiles, r.userId)}: Words ${r.wordsOfAffirmation}, Acts ${r.actsOfService}, Gifts ${r.receivingGifts}, Quality Time ${r.qualityTime}, Touch ${r.physicalTouch}`;
    if (dominant) {
      line += `\n  Dominant: ${LOVE_LANGUAGE_NAMES[dominant]} — ${LOVE_LANGUAGE_DESCRIPTIONS[dominant]}`;
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

/* ──────────────────────────────────────────────────
   Dominant style / language helpers
   ────────────────────────────────────────────────── */

export function getDominantLoveLanguage(
  result: typeof loveLanguageResults.$inferSelect,
): LoveLanguageKey | null {
  const scores: [LoveLanguageKey, number][] = [
    ["W", result.wordsOfAffirmation],
    ["A", result.actsOfService],
    ["G", result.receivingGifts],
    ["Q", result.qualityTime],
    ["T", result.physicalTouch],
  ];
  const max = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
  return max[1] > 0 ? max[0] : null;
}

export function getDominantAttachmentStyle(
  result: typeof attachmentStyleResults.$inferSelect,
): AttachmentStyleKey | null {
  const scores: [AttachmentStyleKey, number][] = [
    ["S", result.secure],
    ["N", result.anxious],
    ["V", result.avoidant],
    ["F", result.fearfulAvoidant],
  ];
  const max = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
  return max[1] > 0 ? max[0] : null;
}

/* ──────────────────────────────────────────────────
   Intake context formatter
   ────────────────────────────────────────────────── */

async function formatIntakeContext(
  coupleId: string,
  memberIds: string[],
  profiles: ProfileRow[],
): Promise<string | undefined> {
  const parts: string[] = [];

  // 1. Couple profile intake fields
  const [profile] = await db
    .select()
    .from(coupleProfiles)
    .where(eq(coupleProfiles.coupleId, coupleId))
    .limit(1);

  if (profile) {
    const cpLines: string[] = [];
    if (profile.relationshipStage)
      cpLines.push(`Relationship stage: ${profile.relationshipStage}`);
    if (profile.togetherSince)
      cpLines.push(`Together since: ${profile.togetherSince}`);
    if (profile.livingSituation)
      cpLines.push(`Living situation: ${profile.livingSituation}`);
    if (profile.children && (profile.children as unknown[]).length > 0) {
      const childList = (
        profile.children as { name: string; age: number; relationship: string }[]
      )
        .map((c) => `${c.name} (${c.age}yo, ${c.relationship})`)
        .join(", ");
      cpLines.push(`Children: ${childList}`);
    }
    if (profile.therapyGoals && (profile.therapyGoals as string[]).length > 0) {
      cpLines.push(`Therapy goals: ${(profile.therapyGoals as string[]).join(", ")}`);
    }
    if (cpLines.length) {
      parts.push(`Relationship Profile:\n${cpLines.join("\n")}`);
    }
  }

  // 2. Dual-perspective responses
  const responses = await db
    .select()
    .from(intakeResponses)
    .where(eq(intakeResponses.coupleId, coupleId));

  if (responses.length > 0) {
    // Group by field, show each partner's perspective
    const byField = new Map<string, { userId: string; value: unknown }[]>();
    for (const r of responses) {
      if (!byField.has(r.field)) byField.set(r.field, []);
      byField.get(r.field)!.push({ userId: r.userId, value: r.value });
    }

    const perspectiveLines: string[] = [];
    for (const [field, entries] of byField) {
      const label = field.replace(/([A-Z])/g, " $1").trim();
      if (entries.length === 1) {
        const name = nameFor(profiles as ProfileRow[], entries[0].userId);
        perspectiveLines.push(`${label} (${name}): ${String(entries[0].value)}`);
      } else {
        for (const e of entries) {
          const name = nameFor(profiles as ProfileRow[], e.userId);
          perspectiveLines.push(`${label} (${name}): ${String(e.value)}`);
        }
      }
    }
    if (perspectiveLines.length) {
      parts.push(`Dual Perspectives:\n${perspectiveLines.join("\n")}`);
    }
  }

  // 3. Individual data from profileData for each member
  for (const userId of memberIds) {
    const p = profiles.find((pr) => pr.id === userId);
    if (!p?.profileData) continue;
    const pd = p.profileData;
    const indParts: string[] = [];

    if (pd.familyOfOrigin) {
      const fo = pd.familyOfOrigin;
      const foLines: string[] = [];
      if (fo.parentsRelationship) foLines.push(`Parents' relationship: ${fo.parentsRelationship}`);
      if (fo.familyConflictStyle) foLines.push(`Family conflict style: ${fo.familyConflictStyle}`);
      if (fo.emotionalEnvironment) foLines.push(`Emotional environment: ${fo.emotionalEnvironment}`);
      if (fo.familyRole) foLines.push(`Family role: ${fo.familyRole}`);
      if (fo.unspokenRules?.length) foLines.push(`Unspoken rules: ${fo.unspokenRules.join(", ")}`);
      if (fo.culturalContext) foLines.push(`Cultural context: ${fo.culturalContext}`);
      if (foLines.length) indParts.push(`Family of Origin:\n${foLines.join("\n")}`);
    }

    if (pd.attachmentHistory) {
      const ah = pd.attachmentHistory;
      const ahLines: string[] = [];
      if (ah.childhoodComfortSource) ahLines.push(`Comfort source: ${ah.childhoodComfortSource}`);
      if (ah.wasComfortAvailable !== undefined) ahLines.push(`Comfort available: ${ah.wasComfortAvailable ? "Yes" : "No"}`);
      if (ah.selfSoothingPatterns?.length) ahLines.push(`Self-soothing: ${ah.selfSoothingPatterns.join(", ")}`);
      if (ah.vulnerabilityComfort) ahLines.push(`Vulnerability comfort: ${ah.vulnerabilityComfort}`);
      if (ahLines.length) indParts.push(`Attachment History:\n${ahLines.join("\n")}`);
    }

    if (pd.externalStressors?.length) indParts.push(`External stressors: ${pd.externalStressors.join(", ")}`);
    if (pd.mentalHealthContext) indParts.push(`Mental health context: ${pd.mentalHealthContext}`);

    if (indParts.length) {
      const name = p.name || "User";
      parts.push(`${name}'s Personal History:\n${indParts.join("\n")}`);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}
