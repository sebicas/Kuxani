/**
 * Intake Interview Questions — Data File
 *
 * Flat array of all intake questions, organized by category.
 * Each question maps to an existing API field so the wizard
 * can save/load through the same /api/intake/phase/[phase] endpoints.
 *
 * Follows quiz-standards §1 (Data File) pattern.
 */

/* ── Types ── */

export type IntakeInputType =
  | "select"
  | "multi_select"
  | "text"
  | "textarea"
  | "date"
  | "boolean"
  | "children"
  | "tags";

export type IntakeStorage = "coupleFacts" | "responses" | "individualData";

export interface IntakeOption {
  value: string;
  label: string;
}

export interface IntakeQuestion {
  /** Unique identifier, e.g. "relationship_stage" */
  id: string;
  /** Maps to original API phase (1-6) for save/load compatibility */
  phase: number;
  /** Key into INTAKE_CATEGORIES */
  category: string;
  /** Display question text */
  question: string;
  /** Optional contextual hint shown below the question */
  helpText?: string;
  /** Input type determines which UI control renders */
  type: IntakeInputType;
  /** Options for select / multi_select types */
  options?: IntakeOption[];
  /** Preset options for tags type (user can add custom) */
  presets?: string[];
  /** API field name used when saving/loading */
  field: string;
  /** Where the answer is stored in the API payload */
  storage: IntakeStorage;
  /** Whether this question is required */
  required?: boolean;
}

export interface IntakeCategory {
  name: string;
  icon: string;
  description: string;
}

/* ── Categories ── */

export const INTAKE_CATEGORIES: Record<string, IntakeCategory> = {
  basics: {
    name: "Relationship Basics",
    icon: "🤝",
    description: "Tell us about your relationship",
  },
  brought_here: {
    name: "What Brought You Here",
    icon: "💭",
    description: "What are you hoping to work on?",
  },
  growing_up: {
    name: "Growing Up",
    icon: "🏠",
    description: "Help your therapist understand where you come from",
  },
  attachment: {
    name: "Attachment & Connection",
    icon: "🔗",
    description: "How you learned to connect and cope",
  },
  communication: {
    name: "Communication & Conflict",
    icon: "⚡",
    description: "How you navigate disagreements together",
  },
  life_context: {
    name: "Life Context",
    icon: "🌎",
    description: "What else is weighing on you?",
  },
};

/* ── Questions ── */

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  /* ── Relationship Basics (Phase 1) ── */
  {
    id: "relationship_stage",
    phase: 1,
    category: "basics",
    question: "What stage is your relationship in?",
    type: "select",
    options: [
      { value: "dating", label: "Dating" },
      { value: "engaged", label: "Engaged" },
      { value: "married", label: "Married" },
      { value: "separated", label: "Separated" },
      { value: "divorced", label: "Divorced" },
      { value: "reconciling", label: "Reconciling" },
    ],
    field: "relationshipStage",
    storage: "coupleFacts",
  },
  {
    id: "together_since",
    phase: 1,
    category: "basics",
    question: "When did your relationship start?",
    helpText: "An approximate date is fine",
    type: "date",
    field: "togetherSince",
    storage: "coupleFacts",
  },
  {
    id: "living_situation",
    phase: 1,
    category: "basics",
    question: "What's your living situation?",
    type: "select",
    options: [
      { value: "together", label: "Living Together" },
      { value: "apart", label: "Living Apart" },
      { value: "long_distance", label: "Long Distance" },
    ],
    field: "livingSituation",
    storage: "coupleFacts",
  },
  {
    id: "children",
    phase: 1,
    category: "basics",
    question: "Do you have any children?",
    helpText: "Add their name, age, and relationship type",
    type: "children",
    field: "children",
    storage: "coupleFacts",
  },
  {
    id: "how_met",
    phase: 1,
    category: "basics",
    question: "How did you and your partner meet?",
    helpText: "Tell the story of how you found each other",
    type: "textarea",
    field: "howMet",
    storage: "responses",
  },
  {
    id: "initial_attraction",
    phase: 1,
    category: "basics",
    question: "What initially attracted you to each other?",
    helpText: "What drew you to your partner?",
    type: "textarea",
    field: "initialAttraction",
    storage: "responses",
  },
  {
    id: "therapy_goals",
    phase: 1,
    category: "basics",
    question: "What are your goals for therapy?",
    helpText: "Select any that apply, or add your own",
    type: "tags",
    presets: [
      "Better communication",
      "Rebuild trust",
      "Resolve conflicts more effectively",
      "Strengthen emotional connection",
      "Improve intimacy",
      "Navigate a major life transition",
      "Heal from past hurts",
      "Understand each other better",
      "Co-parenting alignment",
      "Set healthier boundaries",
      "Manage finances as a team",
      "Reconnect after growing apart",
    ],
    field: "therapyGoals",
    storage: "coupleFacts",
  },

  /* ── What Brought You Here (Phase 2) ── */
  {
    id: "presenting_problem",
    phase: 2,
    category: "brought_here",
    question: "What made you want to work on your relationship right now?",
    helpText: "What's the main reason you're here?",
    type: "textarea",
    field: "presentingProblem",
    storage: "responses",
  },
  {
    id: "biggest_challenges",
    phase: 2,
    category: "brought_here",
    question: "What are the biggest challenges you're facing?",
    helpText: "Describe the main issues in your relationship",
    type: "textarea",
    field: "biggestChallenges",
    storage: "responses",
  },
  {
    id: "success_vision",
    phase: 2,
    category: "brought_here",
    question: "What does success look like for you?",
    helpText: "If therapy works, what would be different?",
    type: "textarea",
    field: "successVision",
    storage: "responses",
  },

  /* ── Growing Up (Phase 3) ── */
  {
    id: "parents_relationship",
    phase: 3,
    category: "growing_up",
    question: "Tell me about your parents' relationship",
    helpText:
      "Were they married? What was their relationship like? Did they divorce?",
    type: "textarea",
    field: "parentsRelationship",
    storage: "individualData",
  },
  {
    id: "family_conflict_style",
    phase: 3,
    category: "growing_up",
    question: "How did your family handle conflict?",
    helpText:
      "Was conflict avoided, loud, passive-aggressive, or openly discussed?",
    type: "textarea",
    field: "familyConflictStyle",
    storage: "individualData",
  },
  {
    id: "emotional_environment",
    phase: 3,
    category: "growing_up",
    question: "What was the emotional environment at home?",
    helpText: "Was it warm, cold, chaotic, rigid, unpredictable...?",
    type: "textarea",
    field: "emotionalEnvironment",
    storage: "individualData",
  },
  {
    id: "family_role",
    phase: 3,
    category: "growing_up",
    question: "What role did you play in your family?",
    type: "select",
    options: [
      { value: "Caretaker", label: "Caretaker" },
      { value: "Peacemaker", label: "Peacemaker" },
      { value: "Rebel", label: "Rebel" },
      { value: "Invisible child", label: "Invisible child" },
      { value: "Golden child", label: "Golden child" },
      { value: "Scapegoat", label: "Scapegoat" },
      { value: "Mediator", label: "Mediator" },
      { value: "Entertainer", label: "Entertainer" },
    ],
    field: "familyRole",
    storage: "individualData",
  },
  {
    id: "unspoken_rules",
    phase: 3,
    category: "growing_up",
    question: "Were there unspoken rules in your family?",
    helpText: 'e.g. "Don\'t show weakness", "Keep it in the family"',
    type: "tags",
    presets: [],
    field: "unspokenRules",
    storage: "individualData",
  },
  {
    id: "significant_losses",
    phase: 3,
    category: "growing_up",
    question: "Any difficult experiences growing up?",
    helpText: "Loss, instability, etc. — share whatever feels comfortable",
    type: "textarea",
    field: "significantLosses",
    storage: "individualData",
  },
  {
    id: "cultural_context",
    phase: 3,
    category: "growing_up",
    question: "Any cultural or religious context that shaped you?",
    helpText:
      "Cultural, religious, or community values that influenced how you relate",
    type: "textarea",
    field: "culturalContext",
    storage: "individualData",
  },

  /* ── Attachment & Connection (Phase 4) ── */
  {
    id: "childhood_comfort_source",
    phase: 4,
    category: "attachment",
    question:
      "When you were upset as a child, who did you go to for comfort?",
    helpText: "A parent, grandparent, sibling, friend... or no one?",
    type: "textarea",
    field: "childhoodComfortSource",
    storage: "individualData",
  },
  {
    id: "was_comfort_available",
    phase: 4,
    category: "attachment",
    question: "Were they usually available when you needed them?",
    type: "boolean",
    field: "wasComfortAvailable",
    storage: "individualData",
  },
  {
    id: "self_soothing_patterns",
    phase: 4,
    category: "attachment",
    question: "How do you comfort yourself when stressed or hurt?",
    helpText:
      "e.g., exercise, isolation, talking to a friend, overwork...",
    type: "textarea",
    field: "selfSoothingPatterns",
    storage: "individualData",
  },
  {
    id: "previous_relationships",
    phase: 4,
    category: "attachment",
    question: "Past relationships — any patterns you've noticed?",
    helpText: "Duration, how they ended, themes that repeat...",
    type: "textarea",
    field: "previousRelationships",
    storage: "individualData",
  },
  {
    id: "vulnerability_comfort",
    phase: 4,
    category: "attachment",
    question:
      "How comfortable are you being vulnerable with your partner?",
    helpText: "Can you show weakness? Ask for help? Share fears?",
    type: "textarea",
    field: "vulnerabilityComfort",
    storage: "individualData",
  },

  /* ── Communication & Conflict (Phase 5) ── */
  {
    id: "typical_disagreement",
    phase: 5,
    category: "communication",
    question: "Walk me through a typical disagreement — what happens?",
    helpText:
      "How does it start? What does each of you do? How does it end?",
    type: "textarea",
    field: "typicalDisagreement",
    storage: "responses",
  },
  {
    id: "pursuer_withdrawer",
    phase: 5,
    category: "communication",
    question: "Is there a pursuer and a withdrawer?",
    helpText:
      "Who tends to chase the conversation? Who tends to shut down or pull away?",
    type: "textarea",
    field: "pursuerWithdrawer",
    storage: "responses",
  },
  {
    id: "repair_strategies",
    phase: 5,
    category: "communication",
    question: "How do you make up after a fight?",
    helpText: "What repair attempts work? Who reaches out first?",
    type: "textarea",
    field: "repairStrategies",
    storage: "responses",
  },
  {
    id: "relationship_strengths",
    phase: 5,
    category: "communication",
    question:
      "What do you do well together? Relationship strengths?",
    helpText: "What are the best parts of your relationship?",
    type: "textarea",
    field: "relationshipStrengths",
    storage: "responses",
  },

  /* ── Life Context (Phase 6) ── */
  {
    id: "external_stressors",
    phase: 6,
    category: "life_context",
    question: "Any external stressors affecting the relationship?",
    helpText: "Select any that apply, or add your own",
    type: "tags",
    presets: [
      "Financial pressure",
      "Work stress",
      "In-law dynamics",
      "Parenting",
      "Health issues",
      "Long distance",
      "Career change",
      "Infidelity recovery",
      "Grief / loss",
      "Mental health",
    ],
    field: "externalStressors",
    storage: "individualData",
  },
  {
    id: "in_law_dynamics",
    phase: 6,
    category: "life_context",
    question: "Any in-law or extended family dynamics?",
    helpText: "Boundary issues, cultural expectations, pressures?",
    type: "textarea",
    field: "inLawDynamics",
    storage: "responses",
  },
  {
    id: "mental_health_context",
    phase: 6,
    category: "life_context",
    question: "Anything about your mental health the therapist should know?",
    helpText:
      "Anxiety, depression, ADHD, medication, etc. — this stays private",
    type: "textarea",
    field: "mentalHealthContext",
    storage: "individualData",
  },
];
