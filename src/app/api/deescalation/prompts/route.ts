/**
 * De-escalation AI Prompts API
 *
 * GET /api/deescalation/prompts — Get calming AI prompts
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { openai, LIGHT_MODEL } from "@/lib/ai/client";
import { loadPersonalContext } from "@/lib/ai/context";
import { buildSystemPrompt } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

const DEESCALATION_BASE_PROMPT = `You are Kuxani, an emergency de-escalation guide. Generate 3 calming prompts for someone experiencing heightened emotions in a relationship conflict.

Each prompt should be:
1. A GROUNDING technique (5 senses, body awareness)
2. A COGNITIVE REFRAME (perspective shift)
3. A DE-ESCALATION phrase (something to say to themselves or their partner)

If you have context about this person's triggers, childhood wounds, or attachment style, tailor the prompts to their specific patterns. Otherwise, keep them general.

Format as JSON array of objects with "type" and "text" fields.
Types: "grounding", "reframe", "phrase"
Keep each under 2 sentences.`;

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load personal context for personalized de-escalation
    const ctx = await loadPersonalContext(session.user.id);
    const systemPrompt = buildSystemPrompt({
      basePrompt: DEESCALATION_BASE_PROMPT,
      ...ctx,
    });

    const completion = await openai.chat.completions.create({
      model: LIGHT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: "Generate de-escalation prompts for right now.",
        },
      ],
      max_tokens: 300,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    }

    throw new Error("No content");
  } catch {
    // Fallback prompts
    return NextResponse.json({
      prompts: [
        {
          type: "grounding",
          text: "Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.",
        },
        {
          type: "reframe",
          text: "Remember: this is you and your partner vs. the problem, not you vs. your partner.",
        },
        {
          type: "phrase",
          text: "I need a moment to collect my thoughts so I can respond with care instead of reacting.",
        },
      ],
    });
  }
}

