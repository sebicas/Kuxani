/**
 * Love Languages Quiz Data
 *
 * 30 paired-choice questions based on Gary Chapman's Five Love Languages.
 * Each pair presents two options from different love languages.
 * The user picks the one that resonates more, and their top language is tallied.
 *
 * Love Languages:
 * - W = Words of Affirmation
 * - A = Acts of Service
 * - G = Receiving Gifts
 * - Q = Quality Time
 * - T = Physical Touch
 */

export type LoveLanguageKey = "W" | "A" | "G" | "Q" | "T";

export interface QuizQuestion {
  id: number;
  optionA: { text: string; language: LoveLanguageKey };
  optionB: { text: string; language: LoveLanguageKey };
}

export const LOVE_LANGUAGE_NAMES: Record<LoveLanguageKey, string> = {
  W: "Words of Affirmation",
  A: "Acts of Service",
  G: "Receiving Gifts",
  Q: "Quality Time",
  T: "Physical Touch",
};

export const LOVE_LANGUAGE_EMOJIS: Record<LoveLanguageKey, string> = {
  W: "💬",
  A: "🤲",
  G: "🎁",
  Q: "⏰",
  T: "🤗",
};

export const LOVE_LANGUAGE_COLORS: Record<LoveLanguageKey, string> = {
  W: "#6366f1",
  A: "#22c55e",
  G: "#f59e0b",
  Q: "#3b82f6",
  T: "#ec4899",
};

export const LOVE_LANGUAGE_DESCRIPTIONS: Record<LoveLanguageKey, string> = {
  W: "You feel most loved when your partner expresses appreciation, encouragement, and affection through words — compliments, love notes, and verbal acknowledgments.",
  A: "You feel most loved when your partner lightens your load by helping out — cooking a meal, running an errand, or handling a task without being asked.",
  G: "You feel most loved when your partner gives thoughtful gifts — not about cost, but about the thought, effort, and meaning behind the gesture.",
  Q: "You feel most loved when your partner gives you their undivided attention — meaningful conversations, shared activities, and being fully present.",
  T: "You feel most loved through physical connection — holding hands, hugs, a gentle touch on the back, or sitting close together.",
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    optionA: { text: "I love it when my partner tells me they're proud of me.", language: "W" },
    optionB: { text: "I love it when my partner helps me with a task I'm struggling with.", language: "A" },
  },
  {
    id: 2,
    optionA: { text: "I feel special when my partner surprises me with a thoughtful gift.", language: "G" },
    optionB: { text: "I love spending uninterrupted time together.", language: "Q" },
  },
  {
    id: 3,
    optionA: { text: "A warm hug from my partner can make everything better.", language: "T" },
    optionB: { text: "Hearing 'I love you' means the world to me.", language: "W" },
  },
  {
    id: 4,
    optionA: { text: "I appreciate when my partner takes care of something on my to-do list.", language: "A" },
    optionB: { text: "I treasure small, meaningful gifts from my partner.", language: "G" },
  },
  {
    id: 5,
    optionA: { text: "I love deep, heart-to-heart conversations with my partner.", language: "Q" },
    optionB: { text: "I feel connected when my partner holds my hand.", language: "T" },
  },
  {
    id: 6,
    optionA: { text: "A sincere compliment from my partner lifts my spirits.", language: "W" },
    optionB: { text: "Nothing says 'I love you' like my partner planning a special date.", language: "Q" },
  },
  {
    id: 7,
    optionA: { text: "I love receiving a surprise gift 'just because.'", language: "G" },
    optionB: { text: "I feel loved when my partner does chores without being asked.", language: "A" },
  },
  {
    id: 8,
    optionA: { text: "Cuddling on the couch is my favorite way to connect.", language: "T" },
    optionB: { text: "I love it when my partner writes me a heartfelt note.", language: "W" },
  },
  {
    id: 9,
    optionA: { text: "I feel cared for when my partner makes me a meal.", language: "A" },
    optionB: { text: "Going for a walk together, just the two of us, is perfect.", language: "Q" },
  },
  {
    id: 10,
    optionA: { text: "I feel loved when my partner gives me a thoughtful souvenir from a trip.", language: "G" },
    optionB: { text: "I feel loved when my partner greets me with a big hug.", language: "T" },
  },
  {
    id: 11,
    optionA: { text: "Words of encouragement from my partner give me confidence.", language: "W" },
    optionB: { text: "I love it when my partner brings me my favorite snack.", language: "G" },
  },
  {
    id: 12,
    optionA: { text: "I feel connected when we do a hobby or activity together.", language: "Q" },
    optionB: { text: "I feel loved when my partner fixes something around the house for me.", language: "A" },
  },
  {
    id: 13,
    optionA: { text: "A gentle touch on my shoulder calms me when I'm stressed.", language: "T" },
    optionB: { text: "I feel special when my partner gives me their full attention.", language: "Q" },
  },
  {
    id: 14,
    optionA: { text: "I appreciate hearing specific things my partner admires about me.", language: "W" },
    optionB: { text: "I feel cared for when my partner helps me when I'm overwhelmed.", language: "A" },
  },
  {
    id: 15,
    optionA: { text: "My partner remembering special occasions with a gift means so much.", language: "G" },
    optionB: { text: "I love it when my partner reaches for my hand spontaneously.", language: "T" },
  },
  {
    id: 16,
    optionA: { text: "An unexpected love text from my partner brightens my day.", language: "W" },
    optionB: { text: "I love coming home to a clean house because my partner tidied up.", language: "A" },
  },
  {
    id: 17,
    optionA: { text: "Planning a trip together is one of my favorite things.", language: "Q" },
    optionB: { text: "I feel loved when my partner gives me flowers or a small present.", language: "G" },
  },
  {
    id: 18,
    optionA: { text: "I feel close to my partner when we sit close and touch.", language: "T" },
    optionB: { text: "I feel loved when my partner tells others what they appreciate about me.", language: "W" },
  },
  {
    id: 19,
    optionA: { text: "I appreciate when my partner runs errands I've been putting off.", language: "A" },
    optionB: { text: "I love having long, uninterrupted conversations.", language: "Q" },
  },
  {
    id: 20,
    optionA: { text: "A handmade gift from my partner touches my heart.", language: "G" },
    optionB: { text: "A back rub from my partner is the best way to unwind.", language: "T" },
  },
  {
    id: 21,
    optionA: { text: "I love receiving encouraging words when things are tough.", language: "W" },
    optionB: { text: "Cooking a meal together is quality time I cherish.", language: "Q" },
  },
  {
    id: 22,
    optionA: { text: "I feel loved when my partner picks up my prescriptions for me.", language: "A" },
    optionB: { text: "I appreciate when my partner surprises me with something I mentioned wanting.", language: "G" },
  },
  {
    id: 23,
    optionA: { text: "I love falling asleep while my partner holds me.", language: "T" },
    optionB: { text: "I feel cared for when my partner takes over a task I don't enjoy.", language: "A" },
  },
  {
    id: 24,
    optionA: { text: "Hearing my partner say 'I'm grateful for you' melts my heart.", language: "W" },
    optionB: { text: "I feel special when my partner brings me a souvenir.", language: "G" },
  },
  {
    id: 25,
    optionA: { text: "I'd choose a full day together over any gift.", language: "Q" },
    optionB: { text: "A surprise kiss makes my day.", language: "T" },
  },
  {
    id: 26,
    optionA: { text: "I treasure handwritten letters from my partner.", language: "W" },
    optionB: { text: "I feel loved when my partner washes my car or does my laundry.", language: "A" },
  },
  {
    id: 27,
    optionA: { text: "Going on a weekend getaway together recharges me.", language: "Q" },
    optionB: { text: "I love it when my partner gives me a meaningful piece of jewelry.", language: "G" },
  },
  {
    id: 28,
    optionA: { text: "Sitting next to my partner with their arm around me feels perfect.", language: "T" },
    optionB: { text: "I love it when my partner leaves me a sweet voicemail.", language: "W" },
  },
  {
    id: 29,
    optionA: { text: "I feel loved when my partner arranges childcare so we can have date night.", language: "A" },
    optionB: { text: "A slow dance in the living room with my partner is heaven.", language: "T" },
  },
  {
    id: 30,
    optionA: { text: "A meaningful gift that shows my partner was thinking of me means everything.", language: "G" },
    optionB: { text: "An afternoon without phones, just talking, is my ideal.", language: "Q" },
  },
];
