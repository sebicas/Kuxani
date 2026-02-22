/**
 * Childhood Wound Extraction Utility
 *
 * Analyzes Phase 3 family-of-origin data and auto-suggests possible
 * childhood wounds using GPT-4.1-mini. Creates wound entries with
 * source="ai" and status="suggested" so the user can review.
 */
import { db } from "@/lib/db";
import { childhoodWounds } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getOpenAI, LIGHT_MODEL } from "@/lib/ai/client";

/** Phase 3 family-of-origin data structure */
interface FamilyOfOriginData {
  parentsRelationship?: string;
  familyConflictStyle?: string;
  emotionalEnvironment?: string;
  familyRole?: string;
  unspokenRules?: string | string[];
  significantLosses?: string | string[];
  culturalContext?: string;
}

/** Extracted wound from AI analysis */
interface ExtractedWound {
  title: string;
  description: string;
  intensity: number;
}

const EXTRACTION_PROMPT = `You are a relationship therapist analyzing family-of-origin data to identify potential childhood wounds.

Given the following family background information, identify any childhood wounds or unresolved attachment injuries that may be affecting the person's current relationship.

For each wound, provide:
- title: A short, compassionate label (e.g., "Abandonment anxiety", "Emotional neglect", "Parentification")
- description: A 1-2 sentence clinical description linking the family pattern to its relational impact
- intensity: A 1-10 score estimating how impactful this wound likely is

Rules:
- Only identify wounds that are clearly supported by the text
- Be compassionate and non-pathologizing in your language
- Maximum 5 wounds per analysis
- If no wounds are apparent, return an empty array
- Focus on patterns that commonly affect adult romantic relationships

Respond with ONLY a JSON array (no markdown, no explanation):
[{"title": "...", "description": "...", "intensity": N}]`;

/**
 * Analyze Phase 3 data and create suggested childhood wounds.
 * Runs asynchronously after Phase 3 completion — does not block the save.
 */
export async function extractChildhoodWounds(
  userId: string,
  familyData: FamilyOfOriginData,
): Promise<void> {
  // Build text from family-of-origin fields
  const parts: string[] = [];
  if (familyData.parentsRelationship)
    parts.push(`Parents' relationship: ${familyData.parentsRelationship}`);
  if (familyData.familyConflictStyle)
    parts.push(`Family conflict style: ${familyData.familyConflictStyle}`);
  if (familyData.emotionalEnvironment)
    parts.push(`Emotional environment: ${familyData.emotionalEnvironment}`);
  if (familyData.familyRole)
    parts.push(`Role in family: ${familyData.familyRole}`);
  if (familyData.unspokenRules) {
    const rules = Array.isArray(familyData.unspokenRules)
      ? familyData.unspokenRules.join(", ")
      : familyData.unspokenRules;
    parts.push(`Unspoken family rules: ${rules}`);
  }
  if (familyData.significantLosses) {
    const losses = Array.isArray(familyData.significantLosses)
      ? familyData.significantLosses.join(", ")
      : familyData.significantLosses;
    parts.push(`Significant losses: ${losses}`);
  }
  if (familyData.culturalContext)
    parts.push(`Cultural context: ${familyData.culturalContext}`);

  const text = parts.join("\n");
  if (!text.trim()) return; // No data to analyze

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: LIGHT_MODEL,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return;

    let wounds: ExtractedWound[];
    try {
      wounds = JSON.parse(content);
    } catch {
      console.error("[extractChildhoodWounds] Failed to parse AI response:", content);
      return;
    }

    if (!Array.isArray(wounds) || wounds.length === 0) return;

    // Check existing AI-suggested wounds to avoid duplicates
    const existing = await db
      .select({ title: childhoodWounds.title })
      .from(childhoodWounds)
      .where(
        and(
          eq(childhoodWounds.userId, userId),
          eq(childhoodWounds.source, "ai"),
        ),
      );
    const existingTitles = new Set(existing.map((w) => w.title.toLowerCase()));

    // Insert new wounds that don't already exist
    const newWounds = wounds
      .filter((w) => w.title && !existingTitles.has(w.title.toLowerCase()))
      .slice(0, 5); // Max 5

    if (newWounds.length === 0) return;

    await db.insert(childhoodWounds).values(
      newWounds.map((w) => ({
        userId,
        title: w.title,
        description: w.description || null,
        intensity: Math.min(10, Math.max(1, Math.round(w.intensity || 5))),
        source: "ai" as const,
        status: "suggested" as const,
      })),
    );

    console.log(
      `[extractChildhoodWounds] Created ${newWounds.length} suggested wounds for user ${userId}`,
    );
  } catch (error) {
    // Non-fatal: log and move on
    console.error("[extractChildhoodWounds] Error:", error);
  }
}
