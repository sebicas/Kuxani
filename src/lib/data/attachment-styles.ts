/**
 * Attachment Styles Quiz Data
 *
 * 20 Likert-scale statements based on adult attachment theory
 * (Bartholomew & Horowitz). Each statement maps to one of four
 * attachment styles. The user rates 1 (Strongly Disagree) to
 * 5 (Strongly Agree). Each style has exactly 5 statements,
 * yielding a score range of 5–25 per style.
 *
 * Attachment Styles:
 * - S = Secure
 * - N = Anxious
 * - V = Avoidant
 * - F = Fearful-Avoidant
 */

export type AttachmentStyleKey = "S" | "N" | "V" | "F";

export interface QuizStatement {
  id: number;
  text: string;
  style: AttachmentStyleKey;
}

export const ATTACHMENT_STYLE_NAMES: Record<AttachmentStyleKey, string> = {
  S: "Secure",
  N: "Anxious",
  V: "Avoidant",
  F: "Fearful-Avoidant",
};

export const ATTACHMENT_STYLE_EMOJIS: Record<AttachmentStyleKey, string> = {
  S: "🛡️",
  N: "💭",
  V: "🏔️",
  F: "🌊",
};

export const ATTACHMENT_STYLE_COLORS: Record<AttachmentStyleKey, string> = {
  S: "#22c55e",
  N: "#f59e0b",
  V: "#6366f1",
  F: "#ec4899",
};

export const ATTACHMENT_STYLE_DESCRIPTIONS: Record<AttachmentStyleKey, string> = {
  S: "You feel comfortable with emotional intimacy and are able to depend on your partner. You communicate your needs openly, handle conflict constructively, and trust that your partner will be there for you.",
  N: "You deeply crave closeness and reassurance from your partner. You may worry about whether your partner truly loves you and can become anxious when they seem distant or unresponsive.",
  V: "You value your independence and self-sufficiency. You may find it difficult to open up emotionally or depend on your partner, and you tend to withdraw when things feel too close.",
  F: "You experience a push-pull dynamic — you desire emotional intimacy but feel overwhelmed or fearful when you have it. You may alternate between seeking closeness and creating distance.",
};

export const LIKERT_LABELS = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
] as const;

export const QUIZ_STATEMENTS: QuizStatement[] = [
  {
    id: 1,
    text: "I find it easy to be emotionally close to my partner.",
    style: "S",
  },
  {
    id: 2,
    text: "I worry that my partner doesn't really love me.",
    style: "N",
  },
  {
    id: 3,
    text: "I prefer not to show a partner how I feel deep down.",
    style: "V",
  },
  {
    id: 4,
    text: "I want to be close to my partner, but I pull away when things get too intimate.",
    style: "F",
  },
  {
    id: 5,
    text: "I'm comfortable depending on my partner when I need support.",
    style: "S",
  },
  {
    id: 6,
    text: "I need a lot of reassurance that my partner cares about me.",
    style: "N",
  },
  {
    id: 7,
    text: "I feel uncomfortable when my partner wants to be very close.",
    style: "V",
  },
  {
    id: 8,
    text: "My feelings toward my partner can swing between wanting closeness and needing distance.",
    style: "F",
  },
  {
    id: 9,
    text: "I feel secure in my partner's love even when we're apart.",
    style: "S",
  },
  {
    id: 10,
    text: "I often worry about being abandoned by my partner.",
    style: "N",
  },
  {
    id: 11,
    text: "I find it difficult to allow myself to depend on my partner.",
    style: "V",
  },
  {
    id: 12,
    text: "I desire closeness but find it hard to fully trust my partner.",
    style: "F",
  },
  {
    id: 13,
    text: "When conflicts arise, I can discuss issues calmly with my partner.",
    style: "S",
  },
  {
    id: 14,
    text: "If my partner doesn't respond quickly, I start to feel anxious.",
    style: "N",
  },
  {
    id: 15,
    text: "I tend to shut down emotionally during disagreements.",
    style: "V",
  },
  {
    id: 16,
    text: "Sometimes I cling to my partner, and other times I push them away.",
    style: "F",
  },
  {
    id: 17,
    text: "I trust that my partner will be there for me when I need them.",
    style: "S",
  },
  {
    id: 18,
    text: "I sometimes feel I love my partner more than they love me.",
    style: "N",
  },
  {
    id: 19,
    text: "I am very self-sufficient and don't like asking my partner for help.",
    style: "V",
  },
  {
    id: 20,
    text: "I want emotional intimacy but get overwhelmed when I have it.",
    style: "F",
  },
];
