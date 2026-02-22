/**
 * Intake Questions Data Tests
 *
 * Validates the integrity of the intake questions data file.
 * Follows quiz-standards §7 (Data Tests) pattern.
 */
import {
  INTAKE_QUESTIONS,
  INTAKE_CATEGORIES,
  type IntakeQuestion,
} from "@/lib/data/intake-questions";

describe("Intake Questions Data", () => {
  it("should have at least 20 questions", () => {
    expect(INTAKE_QUESTIONS.length).toBeGreaterThanOrEqual(20);
  });

  it("should have unique IDs for all questions", () => {
    const ids = INTAKE_QUESTIONS.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have valid phases (1-6) for all questions", () => {
    for (const q of INTAKE_QUESTIONS) {
      expect(q.phase).toBeGreaterThanOrEqual(1);
      expect(q.phase).toBeLessThanOrEqual(6);
    }
  });

  it("should reference valid categories for all questions", () => {
    const categoryKeys = Object.keys(INTAKE_CATEGORIES);
    for (const q of INTAKE_QUESTIONS) {
      expect(categoryKeys).toContain(q.category);
    }
  });

  it("should cover all defined categories", () => {
    const usedCategories = new Set(INTAKE_QUESTIONS.map((q) => q.category));
    for (const key of Object.keys(INTAKE_CATEGORIES)) {
      expect(usedCategories.has(key)).toBe(true);
    }
  });

  it("should have valid input types", () => {
    const validTypes = [
      "select",
      "multi_select",
      "text",
      "textarea",
      "date",
      "boolean",
      "children",
      "tags",
    ];
    for (const q of INTAKE_QUESTIONS) {
      expect(validTypes).toContain(q.type);
    }
  });

  it("should have non-empty options for select/multi_select questions", () => {
    const selectQuestions = INTAKE_QUESTIONS.filter(
      (q) => q.type === "select" || q.type === "multi_select",
    );
    for (const q of selectQuestions) {
      expect(q.options).toBeDefined();
      expect(q.options!.length).toBeGreaterThan(0);
    }
  });

  it("should have valid storage values", () => {
    const validStorage = ["coupleFacts", "responses", "individualData"];
    for (const q of INTAKE_QUESTIONS) {
      expect(validStorage).toContain(q.storage);
    }
  });

  it("should have non-empty question text for all questions", () => {
    for (const q of INTAKE_QUESTIONS) {
      expect(q.question.trim().length).toBeGreaterThan(0);
    }
  });

  it("should have non-empty field names for all questions", () => {
    for (const q of INTAKE_QUESTIONS) {
      expect(q.field.trim().length).toBeGreaterThan(0);
    }
  });

  it("every category should have name, icon, and description", () => {
    for (const [, cat] of Object.entries(INTAKE_CATEGORIES)) {
      expect(cat.name.trim().length).toBeGreaterThan(0);
      expect(cat.icon.trim().length).toBeGreaterThan(0);
      expect(cat.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("questions should be ordered by phase", () => {
    let lastPhase = 0;
    for (const q of INTAKE_QUESTIONS) {
      expect(q.phase).toBeGreaterThanOrEqual(lastPhase);
      lastPhase = q.phase;
    }
  });

  // Suppress unused import warning — the type is tested indirectly
  it("IntakeQuestion type is exported", () => {
    const q: IntakeQuestion = INTAKE_QUESTIONS[0];
    expect(q).toBeDefined();
  });
});
