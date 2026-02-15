/**
 * Attachment Styles Quiz Data — Unit Tests
 *
 * Validates quiz data integrity: statement count, uniqueness,
 * style distribution, and metadata completeness.
 */
import { describe, it, expect } from "vitest";
import {
  QUIZ_STATEMENTS,
  ATTACHMENT_STYLE_NAMES,
  ATTACHMENT_STYLE_EMOJIS,
  ATTACHMENT_STYLE_COLORS,
  ATTACHMENT_STYLE_DESCRIPTIONS,
  LIKERT_LABELS,
  type AttachmentStyleKey,
} from "@/lib/data/attachment-styles";

describe("Attachment Styles Quiz Data", () => {
  it("should have exactly 20 statements", () => {
    expect(QUIZ_STATEMENTS.length).toBe(20);
  });

  it("should have unique statement IDs", () => {
    const ids = QUIZ_STATEMENTS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(20);
  });

  it("each statement should have non-empty text", () => {
    for (const s of QUIZ_STATEMENTS) {
      expect(s.text.length).toBeGreaterThan(10);
    }
  });

  it("all four attachment styles should appear", () => {
    const styles = new Set<AttachmentStyleKey>();
    for (const s of QUIZ_STATEMENTS) {
      styles.add(s.style);
    }
    expect(styles.size).toBe(4);
    expect(styles.has("S")).toBe(true);
    expect(styles.has("N")).toBe(true);
    expect(styles.has("V")).toBe(true);
    expect(styles.has("F")).toBe(true);
  });

  it("each style should have exactly 5 statements", () => {
    const counts: Record<AttachmentStyleKey, number> = { S: 0, N: 0, V: 0, F: 0 };
    for (const s of QUIZ_STATEMENTS) {
      counts[s.style]++;
    }
    for (const key of Object.keys(counts) as AttachmentStyleKey[]) {
      expect(counts[key]).toBe(5);
    }
  });

  it("should have metadata for all four styles", () => {
    const keys: AttachmentStyleKey[] = ["S", "N", "V", "F"];
    for (const key of keys) {
      expect(ATTACHMENT_STYLE_NAMES[key]).toBeDefined();
      expect(ATTACHMENT_STYLE_NAMES[key].length).toBeGreaterThan(0);
      expect(ATTACHMENT_STYLE_EMOJIS[key]).toBeDefined();
      expect(ATTACHMENT_STYLE_COLORS[key]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ATTACHMENT_STYLE_DESCRIPTIONS[key]).toBeDefined();
      expect(ATTACHMENT_STYLE_DESCRIPTIONS[key].length).toBeGreaterThan(20);
    }
  });

  it("should have exactly 5 Likert labels", () => {
    expect(LIKERT_LABELS.length).toBe(5);
  });
});
