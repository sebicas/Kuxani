/**
 * Gratitude AI Prompts API
 *
 * GET /api/gratitude/prompts — Get a daily AI-generated gratitude prompt
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { openai, LIGHT_MODEL } from "@/lib/ai/client";

const PROMPT_CATEGORIES = [
  "appreciation for partner",
  "shared experiences",
  "personal growth together",
  "small daily moments",
  "qualities you admire",
  "challenges overcome together",
  "future hopes",
];

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category =
    PROMPT_CATEGORIES[Math.floor(Math.random() * PROMPT_CATEGORIES.length)];

  try {
    const completion = await openai.chat.completions.create({
      model: LIGHT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are Kuxani, a warm relationship AI. Generate a single gratitude journal prompt for someone in a romantic relationship. The prompt should be:
- Warm and inviting
- Specific enough to inspire reflection
- Focused on the category: "${category}"
- One sentence, ending with a question mark
- No quotation marks around the prompt

Respond with ONLY the prompt text, nothing else.`,
        },
        {
          role: "user",
          content: `Generate a gratitude prompt about "${category}" for today.`,
        },
      ],
      max_tokens: 100,
      temperature: 0.9,
    });

    const prompt =
      completion.choices[0]?.message?.content?.trim() ||
      "What's one thing your partner did recently that made you feel loved?";

    return NextResponse.json({ prompt, category });
  } catch {
    // Fallback prompts if AI is unavailable
    const fallbacks = [
      "What's one thing your partner did recently that made you feel loved?",
      "Describe a moment this week when you felt grateful for your relationship.",
      "What quality in your partner do you most admire today?",
      "What's a small thing your partner does that always makes you smile?",
      "What's a challenge you faced together that made your bond stronger?",
    ];
    const prompt = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return NextResponse.json({ prompt, category: "general" });
  }
}
