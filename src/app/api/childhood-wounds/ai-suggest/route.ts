/**
 * Childhood Wounds API — AI Suggestions
 *
 * POST /api/childhood-wounds/ai-suggest — AI analyzes context and suggests wounds
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { openai, LIGHT_MODEL } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const completion = await openai.chat.completions.create({
    model: LIGHT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are Kuxani, a compassionate AI couples therapist specializing in childhood wounds and attachment patterns.

Based on common childhood wounds observed in relationship therapy, suggest potential childhood wounds that many people carry into adult relationships. These are emotional injuries from childhood that shape how someone behaves in intimate relationships.

Common categories include:
- Abandonment / Fear of being left
- Rejection / Not feeling good enough
- Emotional neglect / Not being seen or heard
- Enmeshment / Loss of boundaries
- Criticism / Perfectionism pressure
- Betrayal / Broken trust
- Parentification / Having to be the caretaker
- Emotional invalidation / Feelings dismissed

Return a JSON array of 5 suggestions. Each suggestion should have:
- "title": A concise name (3-6 words)
- "description": A gentle, therapeutic 1-2 sentence description of how this wound manifests in adult relationships

Be warm and non-clinical. Frame descriptions in terms of patterns ("You may notice..." or "This can show up as...").

Respond ONLY with the JSON array, no other text.`,
      },
      {
        role: "user",
        content:
          "Please suggest some common childhood wounds I might explore for self-awareness in my relationship.",
      },
    ],
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content);
    // Handle both { suggestions: [...] } and direct array responses
    const suggestions = Array.isArray(parsed)
      ? parsed
      : parsed.suggestions || parsed.wounds || [];
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    );
  }
}
