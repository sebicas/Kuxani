/**
 * buildSystemPrompt() Unit Tests
 *
 * Tests the prompt assembly function with all context sections.
 * Pure unit tests — no database or external services needed.
 */
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/prompts";

describe("buildSystemPrompt", () => {
  const BASE = "You are a therapist.";

  it("should return only the base prompt when no context is provided", () => {
    const result = buildSystemPrompt({ basePrompt: BASE });
    expect(result).toBe(BASE);
  });

  it("should inject couple profile section", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      coupleProfile: "Pattern: avoidant-anxious dynamic",
    });
    expect(result).toContain("## Couple Profile");
    expect(result).toContain("avoidant-anxious dynamic");
  });

  it("should inject partner profiles section", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      partnerProfiles: "Alice:\n  Triggers: criticism\n\nBob:\n  Triggers: stonewalling",
    });
    expect(result).toContain("## Partner Profiles");
    expect(result).toContain("Alice:");
    expect(result).toContain("Bob:");
  });

  it("should inject childhood wounds section", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      childhoodWoundsContext: '- Alice: "Abandonment" (intensity 8/10)',
    });
    expect(result).toContain("## Childhood Wounds");
    expect(result).toContain("Abandonment");
    expect(result).toContain("intensity 8/10");
  });

  it("should inject attachment styles section", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      attachmentContext: "Alice: Secure 20, Anxious 8, Avoidant 5, Fearful-Avoidant 7",
    });
    expect(result).toContain("## Attachment Styles");
    expect(result).toContain("Secure 20");
  });

  it("should inject past challenge summaries with numbered headings", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      pastSummaries: ["Topic: finances", "Topic: communication"],
    });
    expect(result).toContain("## Past Challenge Summaries");
    expect(result).toContain("### Challenge 1");
    expect(result).toContain("### Challenge 2");
    expect(result).toContain("finances");
    expect(result).toContain("communication");
  });

  it("should skip past summaries when array is empty", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      pastSummaries: [],
    });
    expect(result).not.toContain("Past Challenge Summaries");
  });

  it("should inject mood context section", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      moodContext: "Alice — anxious (7/10) on 2/14/2026",
    });
    expect(result).toContain("## Recent Mood Trends");
    expect(result).toContain("anxious (7/10)");
  });

  it("should inject de-escalation history section", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      deescalationContext: "Trigger: criticism | Reflection: I need to pause",
    });
    expect(result).toContain("## De-escalation History");
    expect(result).toContain("criticism");
  });

  it("should inject personal profile section", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      personalProfile: "Known triggers: loud voices, sudden changes",
    });
    expect(result).toContain("## Personal Profile");
    expect(result).toContain("loud voices");
  });

  it("should assemble all sections in the correct order", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      coupleProfile: "CP",
      partnerProfiles: "PP",
      childhoodWoundsContext: "CW",
      attachmentContext: "AS",
      pastSummaries: ["S1"],
      moodContext: "MC",
      deescalationContext: "DE",
      personalProfile: "PR",
    });

    const coupleIdx = result.indexOf("## Couple Profile");
    const partnerIdx = result.indexOf("## Partner Profiles");
    const woundsIdx = result.indexOf("## Childhood Wounds");
    const attachIdx = result.indexOf("## Attachment Styles");
    const summIdx = result.indexOf("## Past Challenge Summaries");
    const moodIdx = result.indexOf("## Recent Mood Trends");
    const deescIdx = result.indexOf("## De-escalation History");
    const personalIdx = result.indexOf("## Personal Profile");

    // All sections should exist
    expect(coupleIdx).toBeGreaterThan(-1);
    expect(partnerIdx).toBeGreaterThan(-1);
    expect(woundsIdx).toBeGreaterThan(-1);
    expect(attachIdx).toBeGreaterThan(-1);
    expect(summIdx).toBeGreaterThan(-1);
    expect(moodIdx).toBeGreaterThan(-1);
    expect(deescIdx).toBeGreaterThan(-1);
    expect(personalIdx).toBeGreaterThan(-1);

    // Order: couple → partner → wounds → attach → summaries → mood → deesc → personal
    expect(coupleIdx).toBeLessThan(partnerIdx);
    expect(partnerIdx).toBeLessThan(woundsIdx);
    expect(woundsIdx).toBeLessThan(attachIdx);
    expect(attachIdx).toBeLessThan(summIdx);
    expect(summIdx).toBeLessThan(moodIdx);
    expect(moodIdx).toBeLessThan(deescIdx);
    expect(deescIdx).toBeLessThan(personalIdx);
  });

  it("should skip undefined sections gracefully", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      coupleProfile: undefined,
      partnerProfiles: undefined,
      childhoodWoundsContext: undefined,
      attachmentContext: undefined,
      pastSummaries: undefined,
      moodContext: undefined,
      deescalationContext: undefined,
      personalProfile: undefined,
    });
    expect(result).toBe(BASE);
  });

  it("should handle empty string context gracefully", () => {
    const result = buildSystemPrompt({
      basePrompt: BASE,
      coupleProfile: "",
      partnerProfiles: "",
    });
    // Empty strings are falsy, should not inject sections
    expect(result).not.toContain("## Couple Profile");
    expect(result).not.toContain("## Partner Profiles");
  });
});
