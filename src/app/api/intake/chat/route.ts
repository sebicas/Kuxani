/**
 * Intake Chat API — Conversational AI Intake Interview
 *
 * POST /api/intake/chat — Send message + stream AI response
 *
 * The AI conducts a conversational intake interview, extracting structured
 * data from the conversation and saving it through the same storage paths
 * as the form modality (couple_profiles, intake_responses, user.profileData).
 *
 * Extracted data blocks are fenced in ```intake_data ... ``` and parsed
 * server-side after the stream completes.
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
import { eq, and } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import { INTAKE_INTERVIEW_PROMPT, buildSystemPrompt } from "@/lib/ai/prompts";
import { loadPersonalContext } from "@/lib/ai/context";
import { extractChildhoodWounds } from "@/lib/ai/extract-wounds";

export const dynamic = "force-dynamic";

/** Fields that belong to couple_profiles (Phase 1 couple facts) */
const COUPLE_FACT_FIELDS = new Set([
  "relationshipStage",
  "togetherSince",
  "livingSituation",
  "children",
  "therapyGoals",
]);

/** Fields stored as dual-perspective intake_responses */
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

/** Fields stored in user.profileData (individual data) */
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

/** Fields that map to familyOfOrigin in profileData */
const FAMILY_OF_ORIGIN_FIELDS = new Set([
  "parentsRelationship",
  "familyConflictStyle",
  "emotionalEnvironment",
  "familyRole",
  "unspokenRules",
  "significantLosses",
  "culturalContext",
]);

/** Fields that map to attachmentHistory in profileData */
const ATTACHMENT_HISTORY_FIELDS = new Set([
  "childhoodComfortSource",
  "wasComfortAvailable",
  "selfSoothingPatterns",
  "previousRelationships",
  "vulnerabilityComfort",
]);

/** Map response fields to their API phase */
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

async function getUserCouple(userId: string) {
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return member?.coupleId || null;
}

/**
 * Load all existing intake answers and format them as an explicit
 * "ALREADY ANSWERED" block for the system prompt.
 * This ensures the AI knows exactly which fields to skip.
 */
async function loadAlreadyAnswered(
  userId: string,
  coupleId: string | null
): Promise<string | null> {
  const lines: string[] = [];

  // 1. Couple facts from couple_profiles
  if (coupleId) {
    const [profile] = await db
      .select()
      .from(coupleProfiles)
      .where(eq(coupleProfiles.coupleId, coupleId))
      .limit(1);

    if (profile) {
      if (profile.relationshipStage)
        lines.push(`- relationshipStage: "${profile.relationshipStage}"`);
      if (profile.togetherSince)
        lines.push(`- togetherSince: "${profile.togetherSince}"`);
      if (profile.livingSituation)
        lines.push(`- livingSituation: "${profile.livingSituation}"`);
      if (profile.children && (profile.children as unknown[]).length > 0) {
        const childList = (
          profile.children as { name: string; age: number; relationship: string }[]
        )
          .map((c) => `${c.name} (${c.age}yo, ${c.relationship})`)
          .join(", ");
        lines.push(`- children: [${childList}]`);
      }
      if (profile.therapyGoals && (profile.therapyGoals as string[]).length > 0) {
        lines.push(`- therapyGoals: [${(profile.therapyGoals as string[]).join(", ")}]`);
      }
    }

    // 2. Dual-perspective responses from intake_responses
    const responses = await db
      .select()
      .from(intakeResponses)
      .where(
        and(
          eq(intakeResponses.userId, userId),
          eq(intakeResponses.coupleId, coupleId)
        )
      );

    for (const r of responses) {
      const val = typeof r.value === "string"
        ? `"${r.value.slice(0, 200)}${r.value.length > 200 ? "…" : ""}"`
        : JSON.stringify(r.value);
      lines.push(`- ${r.field}: ${val}`);
    }
  }

  // 3. Individual data from user.profileData
  const [userData] = await db
    .select({ profileData: user.profileData })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const pd = userData?.profileData;
  if (pd) {
    const fo = pd.familyOfOrigin;
    if (fo) {
      if (fo.parentsRelationship) lines.push(`- parentsRelationship: "${fo.parentsRelationship}"`);
      if (fo.familyConflictStyle) lines.push(`- familyConflictStyle: "${fo.familyConflictStyle}"`);
      if (fo.emotionalEnvironment) lines.push(`- emotionalEnvironment: "${fo.emotionalEnvironment}"`);
      if (fo.familyRole) lines.push(`- familyRole: "${fo.familyRole}"`);
      if (fo.unspokenRules?.length) lines.push(`- unspokenRules: [${Array.isArray(fo.unspokenRules) ? fo.unspokenRules.join(", ") : fo.unspokenRules}]`);
      if (fo.significantLosses?.length) lines.push(`- significantLosses: [${Array.isArray(fo.significantLosses) ? fo.significantLosses.join(", ") : fo.significantLosses}]`);
      if (fo.culturalContext) lines.push(`- culturalContext: "${fo.culturalContext}"`);
    }
    const ah = pd.attachmentHistory;
    if (ah) {
      if (ah.childhoodComfortSource) lines.push(`- childhoodComfortSource: "${ah.childhoodComfortSource}"`);
      if (ah.wasComfortAvailable !== undefined) lines.push(`- wasComfortAvailable: ${ah.wasComfortAvailable}`);
      if (ah.selfSoothingPatterns?.length) lines.push(`- selfSoothingPatterns: [${Array.isArray(ah.selfSoothingPatterns) ? ah.selfSoothingPatterns.join(", ") : ah.selfSoothingPatterns}]`);
      if (ah.previousRelationships) lines.push(`- previousRelationships: "${ah.previousRelationships}"`);
      if (ah.vulnerabilityComfort) lines.push(`- vulnerabilityComfort: "${ah.vulnerabilityComfort}"`);
    }
    if (pd.externalStressors?.length) lines.push(`- externalStressors: [${Array.isArray(pd.externalStressors) ? pd.externalStressors.join(", ") : pd.externalStressors}]`);
    if (pd.mentalHealthContext) lines.push(`- mentalHealthContext: "${pd.mentalHealthContext}"`);
  }

  if (lines.length === 0) return null;
  return lines.join("\n");
}

/**
 * Parse intake_data blocks from AI response text.
 * Returns array of extracted data objects.
 */
function parseIntakeData(
  text: string
): Array<{
  phase?: number;
  complete?: boolean;
  coupleFacts?: Record<string, unknown>;
  responses?: Record<string, unknown>;
  individualData?: Record<string, unknown>;
}> {
  const blocks: Array<Record<string, unknown>> = [];
  const regex = /```intake_data\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      blocks.push(parsed);
    } catch {
      // Skip malformed JSON
    }
  }

  return blocks;
}

/**
 * Save extracted intake data to the appropriate storage locations.
 */
async function saveExtractedData(
  userId: string,
  coupleId: string | null,
  data: ReturnType<typeof parseIntakeData>[number]
) {
  // Save couple facts → couple_profiles
  if (data.coupleFacts && coupleId) {
    const updateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data.coupleFacts)) {
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
    for (const [field, value] of Object.entries(data.responses)) {
      if (!RESPONSE_FIELDS.has(field) || value === undefined) continue;
      const phase = RESPONSE_FIELD_PHASE[field] || (data.phase ?? 1);

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

    const currentProfile = userData?.profileData || {};
    let changed = false;

    // Family of origin fields
    const familyUpdates: Record<string, unknown> = {};
    const attachmentUpdates: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(data.individualData)) {
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
  if (data.phase) {
    const [existing] = await db
      .select()
      .from(intakeProgress)
      .where(
        and(
          eq(intakeProgress.userId, userId),
          eq(intakeProgress.phase, data.phase)
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
        coupleId,
        phase: data.phase,
        status: data.complete ? "completed" : "in_progress",
        modalityUsed: "chat",
        startedAt: new Date(),
        completedAt: data.complete ? new Date() : null,
      });
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const coupleId = await getUserCouple(userId);
  const body = await request.json();
  const { message, history } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message content required" },
      { status: 400 }
    );
  }

  // Load personal context for enriched system prompt
  const ctx = await loadPersonalContext(userId);

  // Load explicit already-answered fields for the intake prompt
  const alreadyAnswered = await loadAlreadyAnswered(userId, coupleId);
  let basePrompt = INTAKE_INTERVIEW_PROMPT;
  if (alreadyAnswered) {
    basePrompt += `\n\n## ⚠️ ALREADY ANSWERED — DO NOT ASK THESE AGAIN\n\nThe following fields have already been answered. You MUST NOT ask about any of these topics again. Skip them entirely and move on to the MISSING topics only.\n\n${alreadyAnswered}`;
  }

  const systemPrompt = buildSystemPrompt({
    basePrompt,
    ...ctx,
  });

  // Build messages array from history + new message
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: systemPrompt }];

  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }
  }

  messages.push({ role: "user", content: message.trim() });

  // Stream AI response
  const stream = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages,
    stream: true,
  });

  let fullResponse = "";

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Parse and save extracted intake data
        const intakeBlocks = parseIntakeData(fullResponse);
        for (const block of intakeBlocks) {
          await saveExtractedData(userId, coupleId, block);
        }

        // Emit real-time event to partner if data was saved
        if (intakeBlocks.length > 0 && coupleId) {
          try {
            const { getIO } = await import("@/lib/socket/socketServer");
            const { INTAKE_UPDATED } = await import("@/lib/socket/events");
            getIO().to(`couple:${coupleId}`).emit(INTAKE_UPDATED, {
              phase: intakeBlocks[0].phase || 1,
              action: "chat-data-extracted",
              userId,
            });
          } catch {
            /* socket not available in test */
          }
        }

        // Check if intake is complete
        const isComplete = intakeBlocks.some((b) => b.complete);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, complete: isComplete })}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("[intake/chat] Streaming error:", error);
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
