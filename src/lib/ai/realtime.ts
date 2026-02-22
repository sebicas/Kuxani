/**
 * Realtime API helpers
 *
 * Resolves the correct system prompt, context, and voice for a
 * given module + resource. Used by the shared /api/realtime/session endpoint.
 */
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { personalChats } from "@/lib/db/schema/chats";
import { eq } from "drizzle-orm";
import { loadPersonalContext } from "./context";
import { PERSONAL_THERAPY_PROMPT, INTAKE_INTERVIEW_PROMPT, buildSystemPrompt } from "./prompts";

export type RealtimeModule = "personal" | "disagreement" | "challenge" | "intake";

const DEFAULT_VOICE = "sage";

/**
 * Resolves the system prompt and voice preference for a realtime session.
 * Throws if the user doesn't have access to the requested resource.
 */
export async function resolveRealtimeContext(
  module: RealtimeModule,
  resourceId: string,
  userId: string
): Promise<{ systemPrompt: string; voice: string }> {
  // Load user's voice preference
  const [userData] = await db
    .select({ profileData: user.profileData })
    .from(user)
    .where(eq(user.id, userId));

  const voice = userData?.profileData?.voicePreference ?? DEFAULT_VOICE;

  switch (module) {
    case "personal": {
      // Verify the user owns this chat
      const [chat] = await db
        .select()
        .from(personalChats)
        .where(eq(personalChats.id, resourceId));

      if (!chat || chat.userId !== userId) {
        throw new Error("Chat not found or access denied");
      }

      // Load personal context
      const context = await loadPersonalContext(userId);
      const systemPrompt = buildSystemPrompt({
        basePrompt: PERSONAL_THERAPY_PROMPT + "\n\n## Voice Mode\nYou are in a live voice conversation. Keep responses conversational, warm, and concise. Avoid markdown formatting, bullet points, or long paragraphs — speak as you would in a real therapy session. Use natural pauses and acknowledge what the person just said before responding.",
        ...context,
      });

      return { systemPrompt, voice };
    }

    case "intake": {
      // Intake interview — resourceId is the phase number (used for tracking, not access control)
      const context = await loadPersonalContext(userId);
      const systemPrompt = buildSystemPrompt({
        basePrompt: INTAKE_INTERVIEW_PROMPT + "\n\n## Voice Mode\nYou are in a live voice conversation conducting an intake interview. Keep your responses conversational, warm, and concise. Do NOT output the intake_data blocks in voice mode — they will be extracted from the transcript after the session ends. Instead, just have a natural conversation covering all the intake topics. Use natural pauses and acknowledge what the person just said before responding.\n\nIf Intake Profile data is available in your context, those questions have already been answered — do NOT ask about them again. Focus only on the missing topics. If the user is returning, welcome them back and briefly remind them where you left off before continuing.",
        ...context,
      });

      return { systemPrompt, voice };
    }

    // TODO: Add disagreement and challenge modules
    case "disagreement":
    case "challenge":
      throw new Error(`Module "${module}" is not yet implemented for voice`);

    default:
      throw new Error(`Unknown module: ${module}`);
  }
}
