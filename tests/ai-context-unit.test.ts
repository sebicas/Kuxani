/**
 * AI Context Formatting — Unit Tests
 *
 * Pure unit tests for the formatting helpers in context.ts.
 * No database required — these test the output format, descriptions,
 * recency tagging, and edge cases directly.
 */
import { describe, it, expect } from "vitest";
import {
  recencyTag,
  formatMoodEntries,
  formatChildhoodWounds,
  formatGratitudeEntries,
  formatLoveLanguages,
  formatAttachmentStyles,
  formatDeescalation,
  getDominantLoveLanguage,
  getDominantAttachmentStyle,
  formatPartnerProfiles,
  type ProfileRow,
} from "@/lib/ai/context";
import { buildSystemPrompt } from "@/lib/ai/prompts";

/* ──────────────────────────────────────────────────
   Test fixtures
   ────────────────────────────────────────────────── */

const now = new Date();
const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

const profiles: ProfileRow[] = [
  {
    id: "user-a",
    name: "Alice",
    profileData: {
      triggers: ["criticism"],
      copingMechanisms: ["breathing"],
      growthAreas: ["patience"],
    },
  },
  {
    id: "user-b",
    name: "Bob",
    profileData: {
      triggers: ["silence"],
      copingMechanisms: ["journaling"],
      growthAreas: ["empathy"],
    },
  },
];

/* ──────────────────────────────────────────────────
   recencyTag
   ────────────────────────────────────────────────── */

describe("recencyTag", () => {
  it("should return ⚡ RECENT tag for items within last 24 hours", () => {
    const tag = recencyTag(oneHourAgo);
    expect(tag).toBe("⚡ RECENT — ");
  });

  it("should return ⚡ RECENT tag for items created just now", () => {
    expect(recencyTag(now)).toBe("⚡ RECENT — ");
  });

  it("should return empty string for items older than 24 hours", () => {
    expect(recencyTag(twoDaysAgo)).toBe("");
  });

  it("should return empty string for items from 5 days ago", () => {
    expect(recencyTag(fiveDaysAgo)).toBe("");
  });

  it("should handle the exact 24-hour boundary", () => {
    const exactBoundary = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // At the exact boundary, it should NOT be tagged (> not >=)
    expect(recencyTag(exactBoundary)).toBe("");
  });

  it("should tag items 23h59m ago as recent", () => {
    const justUnder = new Date(Date.now() - (24 * 60 * 60 * 1000 - 60_000));
    expect(recencyTag(justUnder)).toBe("⚡ RECENT — ");
  });
});

/* ──────────────────────────────────────────────────
   formatMoodEntries — full details
   ────────────────────────────────────────────────── */

describe("formatMoodEntries", () => {
  it("should include primary emotion, intensity, and date", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "anxious",
          secondaryEmotion: null,
          intensity: 7,
          notes: null,
          sharedWithPartner: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("Alice");
    expect(result).toContain("anxious");
    expect(result).toContain("7/10");
  });

  it("should include secondary emotion when present", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "sad",
          secondaryEmotion: "overwhelmed",
          intensity: 8,
          notes: null,
          sharedWithPartner: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("sad + overwhelmed");
  });

  it("should include notes when present", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "frustrated",
          secondaryEmotion: null,
          intensity: 6,
          notes: "Argument about chores escalated",
          sharedWithPartner: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("Argument about chores escalated");
  });

  it("should mark shared entries with [shared]", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-b",
          primaryEmotion: "hopeful",
          secondaryEmotion: null,
          intensity: 5,
          notes: null,
          sharedWithPartner: true,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("[shared]");
  });

  it("should NOT include [shared] when sharedWithPartner is false", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "calm",
          secondaryEmotion: null,
          intensity: 3,
          notes: null,
          sharedWithPartner: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).not.toContain("[shared]");
  });

  it("should tag recent entries with ⚡ RECENT", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "angry",
          secondaryEmotion: "hurt",
          intensity: 9,
          notes: "Partner didn't come home on time",
          sharedWithPartner: true,
          createdAt: oneHourAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("⚡ RECENT");
    expect(result).toContain("angry + hurt");
    expect(result).toContain("Partner didn't come home on time");
    expect(result).toContain("[shared]");
  });

  it("should NOT tag old entries with ⚡ RECENT", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "calm",
          secondaryEmotion: null,
          intensity: 2,
          notes: null,
          sharedWithPartner: false,
          createdAt: fiveDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).not.toContain("⚡ RECENT");
  });

  it("should include all fields together for a fully detailed mood entry", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "anxious",
          secondaryEmotion: "fearful",
          intensity: 8,
          notes: "Work deadline plus fight about finances",
          sharedWithPartner: true,
          createdAt: oneHourAgo,
        },
      ],
      profiles,
    );
    // All details should be present in a single entry
    expect(result).toContain("⚡ RECENT");
    expect(result).toContain("Alice");
    expect(result).toContain("anxious + fearful");
    expect(result).toContain("8/10");
    expect(result).toContain("Work deadline plus fight about finances");
    expect(result).toContain("[shared]");
  });

  it("should return undefined for empty mood list", () => {
    expect(formatMoodEntries([], profiles)).toBeUndefined();
  });

  it("should format multiple entries on separate lines", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "happy",
          secondaryEmotion: null,
          intensity: 8,
          notes: null,
          sharedWithPartner: false,
          createdAt: oneHourAgo,
        },
        {
          userId: "user-b",
          primaryEmotion: "sad",
          secondaryEmotion: null,
          intensity: 6,
          notes: null,
          sharedWithPartner: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    const lines = result!.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Alice");
    expect(lines[0]).toContain("happy");
    expect(lines[1]).toContain("Bob");
    expect(lines[1]).toContain("sad");
  });
});

/* ──────────────────────────────────────────────────
   formatChildhoodWounds — full descriptions
   ────────────────────────────────────────────────── */

describe("formatChildhoodWounds", () => {
  it("should include title, intensity, and full description", () => {
    const result = formatChildhoodWounds(
      [
        {
          userId: "user-a",
          title: "Abandonment fear",
          description:
            "Deep fear of being left alone stemming from early childhood when primary caregiver was frequently absent.",
          intensity: 8,
        },
      ],
      profiles,
    );
    expect(result).toContain("Abandonment fear");
    expect(result).toContain("8/10");
    expect(result).toContain(
      "Deep fear of being left alone stemming from early childhood",
    );
    expect(result).toContain("primary caregiver was frequently absent");
  });

  it("should handle wounds without descriptions gracefully", () => {
    const result = formatChildhoodWounds(
      [
        {
          userId: "user-a",
          title: "Minimal wound",
          description: null,
          intensity: 3,
        },
      ],
      profiles,
    );
    expect(result).toContain("Minimal wound");
    expect(result).toContain("3/10");
    // Should NOT have a dangling " — " separator
    expect(result).not.toContain(" — ");
  });

  it("should include user names for multi-person wounds", () => {
    const result = formatChildhoodWounds(
      [
        {
          userId: "user-a",
          title: "Fear of criticism",
          description: "Harsh parenting style created fear of judgment",
          intensity: 7,
        },
        {
          userId: "user-b",
          title: "Emotional neglect",
          description:
            "Parents were physically present but emotionally unavailable",
          intensity: 9,
        },
      ],
      profiles,
    );
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    expect(result).toContain("Fear of criticism");
    expect(result).toContain("Emotional neglect");
    expect(result).toContain("Harsh parenting");
    expect(result).toContain("emotionally unavailable");
  });

  it("should return undefined for empty wounds list", () => {
    expect(formatChildhoodWounds([], profiles)).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────
   formatGratitudeEntries
   ────────────────────────────────────────────────── */

describe("formatGratitudeEntries", () => {
  it("should include gratitude content and user name", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-a",
          content: "Grateful Bob helped with dinner tonight",
          category: "gratitude",
          shared: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("Alice");
    expect(result).toContain("Grateful Bob helped with dinner tonight");
  });

  it("should mark shared entries", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-b",
          content: "Thankful for our walk this weekend",
          category: "gratitude",
          shared: true,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("[shared with partner]");
  });

  it("should NOT show [shared with partner] for unshared entries", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-a",
          content: "Something private",
          category: "gratitude",
          shared: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).not.toContain("[shared with partner]");
  });

  it("should show category label for non-gratitude categories", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-a",
          content: "I love how patient you are with me",
          category: "love_note",
          shared: true,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("(love note)");
  });

  it("should show appreciation category", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-b",
          content: "Thank you for listening today",
          category: "appreciation",
          shared: true,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("(appreciation)");
  });

  it("should NOT show category label for gratitude category", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-a",
          content: "Grateful for a sunny day",
          category: "gratitude",
          shared: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).not.toContain("(gratitude)");
  });

  it("should tag recent gratitude entries with ⚡ RECENT", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-a",
          content: "Just feeling really grateful right now",
          category: "gratitude",
          shared: false,
          createdAt: oneHourAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("⚡ RECENT");
  });

  it("should return undefined for empty gratitude list", () => {
    expect(formatGratitudeEntries([], profiles)).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────
   getDominantLoveLanguage
   ────────────────────────────────────────────────── */

describe("getDominantLoveLanguage", () => {
  const baseLLResult = {
    id: "ll-1",
    userId: "user-a",
    createdAt: new Date(),
  };

  it("should return W when Words of Affirmation is highest", () => {
    expect(
      getDominantLoveLanguage({
        ...baseLLResult,
        wordsOfAffirmation: 12,
        actsOfService: 5,
        receivingGifts: 3,
        qualityTime: 8,
        physicalTouch: 4,
      }),
    ).toBe("W");
  });

  it("should return A when Acts of Service is highest", () => {
    expect(
      getDominantLoveLanguage({
        ...baseLLResult,
        wordsOfAffirmation: 3,
        actsOfService: 10,
        receivingGifts: 5,
        qualityTime: 8,
        physicalTouch: 4,
      }),
    ).toBe("A");
  });

  it("should return Q when Quality Time is highest", () => {
    expect(
      getDominantLoveLanguage({
        ...baseLLResult,
        wordsOfAffirmation: 3,
        actsOfService: 5,
        receivingGifts: 2,
        qualityTime: 11,
        physicalTouch: 4,
      }),
    ).toBe("Q");
  });

  it("should return T when Physical Touch is highest", () => {
    expect(
      getDominantLoveLanguage({
        ...baseLLResult,
        wordsOfAffirmation: 3,
        actsOfService: 5,
        receivingGifts: 2,
        qualityTime: 4,
        physicalTouch: 10,
      }),
    ).toBe("T");
  });

  it("should return G when Receiving Gifts is highest", () => {
    expect(
      getDominantLoveLanguage({
        ...baseLLResult,
        wordsOfAffirmation: 3,
        actsOfService: 5,
        receivingGifts: 12,
        qualityTime: 4,
        physicalTouch: 2,
      }),
    ).toBe("G");
  });

  it("should return null when all scores are zero", () => {
    expect(
      getDominantLoveLanguage({
        ...baseLLResult,
        wordsOfAffirmation: 0,
        actsOfService: 0,
        receivingGifts: 0,
        qualityTime: 0,
        physicalTouch: 0,
      }),
    ).toBeNull();
  });
});

/* ──────────────────────────────────────────────────
   getDominantAttachmentStyle
   ────────────────────────────────────────────────── */

describe("getDominantAttachmentStyle", () => {
  const baseAttResult = {
    id: "att-1",
    userId: "user-a",
    createdAt: new Date(),
  };

  it("should return S when Secure is highest", () => {
    expect(
      getDominantAttachmentStyle({
        ...baseAttResult,
        secure: 20,
        anxious: 10,
        avoidant: 5,
        fearfulAvoidant: 3,
      }),
    ).toBe("S");
  });

  it("should return N when Anxious is highest", () => {
    expect(
      getDominantAttachmentStyle({
        ...baseAttResult,
        secure: 10,
        anxious: 22,
        avoidant: 5,
        fearfulAvoidant: 8,
      }),
    ).toBe("N");
  });

  it("should return V when Avoidant is highest", () => {
    expect(
      getDominantAttachmentStyle({
        ...baseAttResult,
        secure: 5,
        anxious: 10,
        avoidant: 20,
        fearfulAvoidant: 8,
      }),
    ).toBe("V");
  });

  it("should return F when Fearful-Avoidant is highest", () => {
    expect(
      getDominantAttachmentStyle({
        ...baseAttResult,
        secure: 5,
        anxious: 10,
        avoidant: 8,
        fearfulAvoidant: 22,
      }),
    ).toBe("F");
  });

  it("should return null when all scores are zero", () => {
    expect(
      getDominantAttachmentStyle({
        ...baseAttResult,
        secure: 0,
        anxious: 0,
        avoidant: 0,
        fearfulAvoidant: 0,
      }),
    ).toBeNull();
  });
});

/* ──────────────────────────────────────────────────
   formatLoveLanguages — includes descriptions
   ────────────────────────────────────────────────── */

describe("formatLoveLanguages", () => {
  it("should include all scores and dominant language description", () => {
    const result = formatLoveLanguages(
      [
        {
          id: "ll-1",
          userId: "user-a",
          wordsOfAffirmation: 10,
          actsOfService: 5,
          receivingGifts: 3,
          qualityTime: 8,
          physicalTouch: 4,
          createdAt: new Date(),
        },
      ],
      profiles,
    );
    expect(result).toContain("Alice");
    expect(result).toContain("Words 10");
    expect(result).toContain("Acts 5");
    expect(result).toContain("Gifts 3");
    expect(result).toContain("Quality Time 8");
    expect(result).toContain("Touch 4");
    // Should include the dominant language description
    expect(result).toContain("Dominant: Words of Affirmation");
    expect(result).toContain("compliments, love notes");
  });

  it("should show Acts of Service description when dominant", () => {
    const result = formatLoveLanguages(
      [
        {
          id: "ll-2",
          userId: "user-b",
          wordsOfAffirmation: 3,
          actsOfService: 12,
          receivingGifts: 5,
          qualityTime: 4,
          physicalTouch: 2,
          createdAt: new Date(),
        },
      ],
      profiles,
    );
    expect(result).toContain("Dominant: Acts of Service");
    expect(result).toContain("lightens your load");
  });

  it("should de-duplicate users (only show latest per user)", () => {
    const result = formatLoveLanguages(
      [
        {
          id: "ll-new",
          userId: "user-a",
          wordsOfAffirmation: 10,
          actsOfService: 5,
          receivingGifts: 3,
          qualityTime: 8,
          physicalTouch: 4,
          createdAt: new Date(),
        },
        {
          id: "ll-old",
          userId: "user-a",
          wordsOfAffirmation: 2,
          actsOfService: 1,
          receivingGifts: 1,
          qualityTime: 1,
          physicalTouch: 1,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ],
      profiles,
    );
    // Should only appear once
    const aliceCount = (result!.match(/Alice/g) || []).length;
    expect(aliceCount).toBe(1);
  });

  it("should return undefined for empty list", () => {
    expect(formatLoveLanguages([], profiles)).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────
   formatAttachmentStyles — includes descriptions
   ────────────────────────────────────────────────── */

describe("formatAttachmentStyles", () => {
  it("should include all scores and dominant style description", () => {
    const result = formatAttachmentStyles(
      [
        {
          id: "att-1",
          userId: "user-a",
          secure: 20,
          anxious: 12,
          avoidant: 5,
          fearfulAvoidant: 3,
          createdAt: new Date(),
        },
      ],
      profiles,
    );
    expect(result).toContain("Alice");
    expect(result).toContain("Secure 20");
    expect(result).toContain("Anxious 12");
    expect(result).toContain("Avoidant 5");
    expect(result).toContain("Fearful-Avoidant 3");
    expect(result).toContain("Dominant: Secure");
    expect(result).toContain("comfortable with emotional intimacy");
  });

  it("should show Anxious description when dominant", () => {
    const result = formatAttachmentStyles(
      [
        {
          id: "att-2",
          userId: "user-b",
          secure: 5,
          anxious: 22,
          avoidant: 8,
          fearfulAvoidant: 3,
          createdAt: new Date(),
        },
      ],
      profiles,
    );
    expect(result).toContain("Dominant: Anxious");
    expect(result).toContain("crave closeness and reassurance");
  });

  it("should show Avoidant description when dominant", () => {
    const result = formatAttachmentStyles(
      [
        {
          id: "att-3",
          userId: "user-a",
          secure: 5,
          anxious: 8,
          avoidant: 20,
          fearfulAvoidant: 3,
          createdAt: new Date(),
        },
      ],
      profiles,
    );
    expect(result).toContain("Dominant: Avoidant");
    expect(result).toContain("independence and self-sufficiency");
  });

  it("should show Fearful-Avoidant description when dominant", () => {
    const result = formatAttachmentStyles(
      [
        {
          id: "att-4",
          userId: "user-a",
          secure: 5,
          anxious: 8,
          avoidant: 6,
          fearfulAvoidant: 22,
          createdAt: new Date(),
        },
      ],
      profiles,
    );
    expect(result).toContain("Dominant: Fearful-Avoidant");
    expect(result).toContain("push-pull dynamic");
  });

  it("should return undefined for empty list", () => {
    expect(formatAttachmentStyles([], profiles)).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────
   formatDeescalation — recency
   ────────────────────────────────────────────────── */

describe("formatDeescalation", () => {
  it("should include trigger reason and reflection", () => {
    const result = formatDeescalation([
      {
        triggerReason: "Raised voice during argument",
        reflection: "I need to breathe before responding",
        createdAt: twoDaysAgo,
      },
    ]);
    expect(result).toContain("Raised voice during argument");
    expect(result).toContain("I need to breathe before responding");
  });

  it("should tag recent de-escalation sessions with ⚡ RECENT", () => {
    const result = formatDeescalation([
      {
        triggerReason: "Slammed door",
        reflection: "Need to walk away calmly",
        createdAt: oneHourAgo,
      },
    ]);
    expect(result).toContain("⚡ RECENT");
  });

  it("should NOT tag old sessions with ⚡ RECENT", () => {
    const result = formatDeescalation([
      {
        triggerReason: "Old trigger",
        reflection: "Learned from it",
        createdAt: fiveDaysAgo,
      },
    ]);
    expect(result).not.toContain("⚡ RECENT");
  });

  it("should return undefined for empty list", () => {
    expect(formatDeescalation([])).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────
   formatPartnerProfiles — enriched with descriptions
   ────────────────────────────────────────────────── */

describe("formatPartnerProfiles", () => {
  it("should include love language and attachment style descriptions", () => {
    const result = formatPartnerProfiles(
      profiles,
      [
        {
          id: "ll-a",
          userId: "user-a",
          wordsOfAffirmation: 10,
          actsOfService: 5,
          receivingGifts: 3,
          qualityTime: 8,
          physicalTouch: 4,
          createdAt: new Date(),
        },
      ],
      [
        {
          id: "att-a",
          userId: "user-a",
          secure: 20,
          anxious: 12,
          avoidant: 5,
          fearfulAvoidant: 3,
          createdAt: new Date(),
        },
      ],
    );
    expect(result).toContain("Alice:");
    expect(result).toContain("Love languages: Words 10");
    expect(result).toContain("Dominant: Words of Affirmation");
    expect(result).toContain("Attachment: Secure 20");
    expect(result).toContain("Dominant: Secure");
  });

  it("should include profile data like triggers and coping mechanisms", () => {
    const result = formatPartnerProfiles(profiles, [], []);
    expect(result).toContain("Triggers: criticism");
    expect(result).toContain("Coping: breathing");
    expect(result).toContain("Growth: patience");
  });

  it("should return undefined for empty profiles", () => {
    expect(formatPartnerProfiles([], [], [])).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────
   24-hour recency across multiple entry types
   ────────────────────────────────────────────────── */

describe("24-hour recency prioritization", () => {
  it("should tag recent mood but not old mood entries", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "angry",
          secondaryEmotion: "hurt",
          intensity: 9,
          notes: "Big fight just happened",
          sharedWithPartner: true,
          createdAt: oneHourAgo,
        },
        {
          userId: "user-a",
          primaryEmotion: "calm",
          secondaryEmotion: null,
          intensity: 3,
          notes: null,
          sharedWithPartner: false,
          createdAt: fiveDaysAgo,
        },
      ],
      profiles,
    );
    const lines = result!.split("\n");
    expect(lines[0]).toContain("⚡ RECENT");
    expect(lines[0]).toContain("angry + hurt");
    expect(lines[0]).toContain("Big fight just happened");
    expect(lines[1]).not.toContain("⚡ RECENT");
    expect(lines[1]).toContain("calm");
  });

  it("should tag recent gratitude but not old gratitude entries", () => {
    const result = formatGratitudeEntries(
      [
        {
          userId: "user-a",
          content: "Loved our talk just now",
          category: "love_note",
          shared: true,
          createdAt: oneHourAgo,
        },
        {
          userId: "user-b",
          content: "Nice weather last week",
          category: "gratitude",
          shared: false,
          createdAt: fiveDaysAgo,
        },
      ],
      profiles,
    );
    const lines = result!.split("\n");
    expect(lines[0]).toContain("⚡ RECENT");
    expect(lines[0]).toContain("Loved our talk just now");
    expect(lines[1]).not.toContain("⚡ RECENT");
  });

  it("should tag recent de-escalation but not old sessions", () => {
    const result = formatDeescalation([
      {
        triggerReason: "Yelling match 30 minutes ago",
        reflection: "I lost control",
        createdAt: oneHourAgo,
      },
      {
        triggerReason: "Old trigger",
        reflection: null,
        createdAt: twoDaysAgo,
      },
    ]);
    const lines = result!.split("\n");
    expect(lines[0]).toContain("⚡ RECENT");
    expect(lines[0]).toContain("Yelling match");
    expect(lines[1]).not.toContain("⚡ RECENT");
  });
});

/* ──────────────────────────────────────────────────
   buildSystemPrompt — integrates all context sections
   ────────────────────────────────────────────────── */

describe("buildSystemPrompt context integration", () => {
  it("should include recency awareness instruction", () => {
    const prompt = buildSystemPrompt({
      basePrompt: "You are Kuxani.",
      moodContext: "Alice — calm (3/10)",
    });
    expect(prompt).toContain("⚡ Recency Awareness");
    expect(prompt).toContain("Prioritise these in your responses");
  });

  it("should include gratitude section when provided", () => {
    const prompt = buildSystemPrompt({
      basePrompt: "You are Kuxani.",
      gratitudeContext: 'Alice: "Grateful for Bob helping today"',
    });
    expect(prompt).toContain("## Gratitude & Appreciation");
    expect(prompt).toContain("Grateful for Bob helping today");
  });

  it("should include love language section when provided", () => {
    const prompt = buildSystemPrompt({
      basePrompt: "You are Kuxani.",
      loveLanguageContext:
        "Alice: Words 10, Acts 5\n  Dominant: Words of Affirmation",
    });
    expect(prompt).toContain("## Love Languages");
    expect(prompt).toContain("Dominant: Words of Affirmation");
  });

  it("should include all context sections when everything is provided", () => {
    const prompt = buildSystemPrompt({
      basePrompt: "You are Kuxani.",
      coupleProfile: "Communication: pursuer-withdrawer",
      partnerProfiles: "Alice:\n  Triggers: criticism",
      childhoodWoundsContext: 'Alice: "Abandonment fear" (intensity 8/10)',
      attachmentContext: "Alice: Secure 20, Anxious 12",
      loveLanguageContext: "Alice: Words 10, Acts 5",
      moodContext: "⚡ RECENT — Alice — angry (9/10)",
      deescalationContext: "Trigger: Raised voice",
      gratitudeContext: "Alice: Grateful for Bob",
      personalProfile: "Known triggers: criticism",
      pastSummaries: ["Topic: finances\nThemes: spending"],
    });

    expect(prompt).toContain("## Couple Profile");
    expect(prompt).toContain("## Partner Profiles");
    expect(prompt).toContain("## Childhood Wounds");
    expect(prompt).toContain("## Attachment Styles");
    expect(prompt).toContain("## Love Languages");
    expect(prompt).toContain("## Past Challenge Summaries");
    expect(prompt).toContain("## Recent Mood Trends");
    expect(prompt).toContain("## De-escalation History");
    expect(prompt).toContain("## Gratitude & Appreciation");
    expect(prompt).toContain("## Personal Profile");
  });

  it("should omit sections that are undefined", () => {
    const prompt = buildSystemPrompt({
      basePrompt: "You are Kuxani.",
      moodContext: "Alice — calm (3/10)",
    });
    expect(prompt).toContain("## Recent Mood Trends");
    expect(prompt).not.toContain("## Couple Profile");
    expect(prompt).not.toContain("## Gratitude");
    expect(prompt).not.toContain("## Love Languages");
    expect(prompt).not.toContain("## Childhood Wounds");
  });
});

/* ──────────────────────────────────────────────────
   Edge cases & fallbacks
   ────────────────────────────────────────────────── */

describe("Edge cases", () => {
  it("should use 'Partner' when user name is not found in profiles", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "unknown-user",
          primaryEmotion: "happy",
          secondaryEmotion: null,
          intensity: 5,
          notes: null,
          sharedWithPartner: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("Partner");
    expect(result).not.toContain("Alice");
    expect(result).not.toContain("Bob");
  });

  it("should use 'Partner' when profiles list is empty", () => {
    const result = formatChildhoodWounds(
      [
        {
          userId: "user-a",
          title: "Some wound",
          description: "Description of wound",
          intensity: 5,
        },
      ],
      [],
    );
    expect(result).toContain("Partner");
  });

  it("should handle null profileData in partner profiles", () => {
    const profilesWithNull: ProfileRow[] = [
      { id: "user-x", name: "Xena", profileData: null },
    ];
    const result = formatPartnerProfiles(profilesWithNull, [], []);
    expect(result).toContain("Xena:");
    // Should not crash or contain undefined
    expect(result).not.toContain("undefined");
  });

  it("should handle mood entry with all optional fields null", () => {
    const result = formatMoodEntries(
      [
        {
          userId: "user-a",
          primaryEmotion: "neutral",
          secondaryEmotion: null,
          intensity: 5,
          notes: null,
          sharedWithPartner: false,
          createdAt: twoDaysAgo,
        },
      ],
      profiles,
    );
    expect(result).toContain("neutral");
    expect(result).toContain("5/10");
    expect(result).not.toContain("+"); // no secondary emotion
    expect(result).not.toContain("[shared]");
  });

  it("should handle multiple users with same dominant love language", () => {
    const result = formatLoveLanguages(
      [
        {
          id: "ll-a",
          userId: "user-a",
          wordsOfAffirmation: 10,
          actsOfService: 5,
          receivingGifts: 3,
          qualityTime: 8,
          physicalTouch: 4,
          createdAt: new Date(),
        },
        {
          id: "ll-b",
          userId: "user-b",
          wordsOfAffirmation: 12,
          actsOfService: 2,
          receivingGifts: 3,
          qualityTime: 4,
          physicalTouch: 1,
          createdAt: new Date(),
        },
      ],
      profiles,
    );
    // Both should have Words of Affirmation as dominant
    const dominantCount = (
      result!.match(/Dominant: Words of Affirmation/g) || []
    ).length;
    expect(dominantCount).toBe(2);
  });
});
