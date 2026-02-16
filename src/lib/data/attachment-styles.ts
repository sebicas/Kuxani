/**
 * Attachment Styles Quiz Data
 *
 * 40 Likert-scale statements based on adult attachment theory
 * (Bartholomew & Horowitz, ECR-R). Each statement maps to one of
 * four attachment styles. The user rates 1 (Strongly Disagree) to
 * 7 (Strongly Agree). Each style has exactly 10 statements,
 * yielding a score range of 10–70 per style.
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
  "No, Strongly Disagree",
  "Disagree",
  "Somewhat Disagree",
  "Neutral",
  "Somewhat Agree",
  "Agree",
  "Yes, Strongly Agree",
] as const;

export const QUIZ_STATEMENTS: QuizStatement[] = [
  // ── Secure (S) ──────────────────────────────────────────────
  {
    id: 1,
    text: "I find it easy to be emotionally close to my partner.",
    style: "S",
  },
  {
    id: 2,
    text: "I'm comfortable depending on my partner when I need support.",
    style: "S",
  },
  {
    id: 3,
    text: "I feel secure in my partner's love even when we're apart.",
    style: "S",
  },
  {
    id: 4,
    text: "When conflicts arise, I can discuss issues calmly with my partner.",
    style: "S",
  },
  {
    id: 5,
    text: "I trust that my partner will be there for me when I need them.",
    style: "S",
  },
  {
    id: 6,
    text: "I feel at ease sharing my deepest thoughts and feelings with my partner.",
    style: "S",
  },
  {
    id: 7,
    text: "I believe that most disagreements with my partner can be worked through.",
    style: "S",
  },
  {
    id: 8,
    text: "I am confident that my partner loves me and values our relationship.",
    style: "S",
  },
  {
    id: 9,
    text: "I can ask my partner for comfort without feeling embarrassed or weak.",
    style: "S",
  },
  {
    id: 10,
    text: "Even after an argument, I feel confident that my partner and I will reconnect.",
    style: "S",
  },

  // ── Anxious (N) ─────────────────────────────────────────────
  {
    id: 11,
    text: "I worry that my partner doesn't really love me.",
    style: "N",
  },
  {
    id: 12,
    text: "I need a lot of reassurance that my partner cares about me.",
    style: "N",
  },
  {
    id: 13,
    text: "I often worry about being abandoned by my partner.",
    style: "N",
  },
  {
    id: 14,
    text: "If my partner doesn't respond quickly, I start to feel anxious.",
    style: "N",
  },
  {
    id: 15,
    text: "I sometimes feel I love my partner more than they love me.",
    style: "N",
  },
  {
    id: 16,
    text: "When my partner is away, I find myself constantly checking for messages.",
    style: "N",
  },
  {
    id: 17,
    text: "I get upset if my partner doesn't show enough affection.",
    style: "N",
  },
  {
    id: 18,
    text: "I tend to overthink small changes in my partner's behavior or mood.",
    style: "N",
  },
  {
    id: 19,
    text: "I fear that my partner will find someone better and leave me.",
    style: "N",
  },
  {
    id: 20,
    text: "I feel panicked when my partner seems emotionally unavailable.",
    style: "N",
  },

  // ── Avoidant (V) ────────────────────────────────────────────
  {
    id: 21,
    text: "I prefer not to show a partner how I feel deep down.",
    style: "V",
  },
  {
    id: 22,
    text: "I feel uncomfortable when my partner wants to be very close.",
    style: "V",
  },
  {
    id: 23,
    text: "I find it difficult to allow myself to depend on my partner.",
    style: "V",
  },
  {
    id: 24,
    text: "I tend to shut down emotionally during disagreements.",
    style: "V",
  },
  {
    id: 25,
    text: "I am very self-sufficient and don't like asking my partner for help.",
    style: "V",
  },
  {
    id: 26,
    text: "I feel smothered when my partner wants to spend too much time together.",
    style: "V",
  },
  {
    id: 27,
    text: "I keep certain thoughts and feelings to myself rather than sharing them.",
    style: "V",
  },
  {
    id: 28,
    text: "I'd rather solve my problems on my own than involve my partner.",
    style: "V",
  },
  {
    id: 29,
    text: "Talking about emotions with my partner makes me uncomfortable.",
    style: "V",
  },
  {
    id: 30,
    text: "I value my independence more than emotional closeness in a relationship.",
    style: "V",
  },

  // ── Fearful-Avoidant (F) ────────────────────────────────────
  {
    id: 31,
    text: "I want to be close to my partner, but I pull away when things get too intimate.",
    style: "F",
  },
  {
    id: 32,
    text: "My feelings toward my partner can swing between wanting closeness and needing distance.",
    style: "F",
  },
  {
    id: 33,
    text: "I desire closeness but find it hard to fully trust my partner.",
    style: "F",
  },
  {
    id: 34,
    text: "Sometimes I cling to my partner, and other times I push them away.",
    style: "F",
  },
  {
    id: 35,
    text: "I want emotional intimacy but get overwhelmed when I have it.",
    style: "F",
  },
  {
    id: 36,
    text: "I often feel torn between wanting love and being afraid of getting hurt.",
    style: "F",
  },
  {
    id: 37,
    text: "I find myself testing my partner's loyalty even when things are going well.",
    style: "F",
  },
  {
    id: 38,
    text: "After a vulnerable moment, I often regret opening up and withdraw.",
    style: "F",
  },
  {
    id: 39,
    text: "I crave a deep bond with my partner but fear it will end in pain.",
    style: "F",
  },
  {
    id: 40,
    text: "My relationship behavior feels unpredictable, even to me.",
    style: "F",
  },
];
