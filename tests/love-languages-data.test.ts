/**
 * Love Languages Quiz Data — Unit Tests
 *
 * Validates quiz data integrity: question coverage, uniqueness,
 * and language distribution (no HTTP or DB needed).
 */
import { describe, it, expect } from "vitest";
import {
  QUIZ_QUESTIONS,
  LOVE_LANGUAGE_NAMES,
  LOVE_LANGUAGE_EMOJIS,
  LOVE_LANGUAGE_COLORS,
  LOVE_LANGUAGE_DESCRIPTIONS,
  type LoveLanguageKey,
} from "@/lib/data/love-languages";

describe("Love Languages Quiz Data", () => {
  it("should have exactly 30 questions", () => {
    expect(QUIZ_QUESTIONS.length).toBe(30);
  });

  it("should have unique question IDs", () => {
    const ids = QUIZ_QUESTIONS.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(30);
  });

  it("each question should have two different languages", () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.optionA.language).not.toBe(q.optionB.language);
    }
  });

  it("each question should have non-empty text", () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.optionA.text.length).toBeGreaterThan(10);
      expect(q.optionB.text.length).toBeGreaterThan(10);
    }
  });

  it("all five languages should appear in the quiz", () => {
    const languages = new Set<LoveLanguageKey>();
    for (const q of QUIZ_QUESTIONS) {
      languages.add(q.optionA.language);
      languages.add(q.optionB.language);
    }
    expect(languages.size).toBe(5);
    expect(languages.has("W")).toBe(true);
    expect(languages.has("A")).toBe(true);
    expect(languages.has("G")).toBe(true);
    expect(languages.has("Q")).toBe(true);
    expect(languages.has("T")).toBe(true);
  });

  it("language distribution should be roughly balanced", () => {
    const counts: Record<LoveLanguageKey, number> = { W: 0, A: 0, G: 0, Q: 0, T: 0 };
    for (const q of QUIZ_QUESTIONS) {
      counts[q.optionA.language]++;
      counts[q.optionB.language]++;
    }
    // Each language should appear at least 10 times (60 total slots / 5 languages = 12 avg)
    for (const key of Object.keys(counts) as LoveLanguageKey[]) {
      expect(counts[key]).toBeGreaterThanOrEqual(10);
      expect(counts[key]).toBeLessThanOrEqual(14);
    }
  });

  it("should have metadata for all five languages", () => {
    const keys: LoveLanguageKey[] = ["W", "A", "G", "Q", "T"];
    for (const key of keys) {
      expect(LOVE_LANGUAGE_NAMES[key]).toBeDefined();
      expect(LOVE_LANGUAGE_NAMES[key].length).toBeGreaterThan(0);
      expect(LOVE_LANGUAGE_EMOJIS[key]).toBeDefined();
      expect(LOVE_LANGUAGE_COLORS[key]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(LOVE_LANGUAGE_DESCRIPTIONS[key]).toBeDefined();
      expect(LOVE_LANGUAGE_DESCRIPTIONS[key].length).toBeGreaterThan(20);
    }
  });
});
