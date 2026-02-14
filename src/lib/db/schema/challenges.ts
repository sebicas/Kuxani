import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { couples } from "./couples";

/* ── Enums ── */
export const challengeCategoryEnum = pgEnum("challenge_category", [
  "communication",
  "finances",
  "parenting",
  "intimacy",
  "household",
  "trust",
  "boundaries",
  "family",
  "work_life",
  "other",
]);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "created",
  "perspectives",
  "submitted",
  "synthesis",
  "review",
  "discussion",
  "commitments",
  "resolved",
]);

export const senderTypeEnum = pgEnum("sender_type", ["user", "ai"]);

export const requestCategoryEnum = pgEnum("request_category", [
  "apology",
  "behavior_change",
  "reassurance",
  "boundary",
  "other",
]);

export const fileTypeEnum = pgEnum("file_type", [
  "whatsapp_export",
  "image",
  "audio",
  "document",
  "other",
]);

export const voiceSessionStatusEnum = pgEnum("voice_session_status", [
  "waiting",
  "active",
  "ended",
]);

export const speakerTypeEnum = pgEnum("voice_speaker_type", [
  "partner_a",
  "partner_b",
  "ai",
]);

/* ── Challenges ── */
export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  category: challengeCategoryEnum("category").default("other").notNull(),
  status: challengeStatusEnum("status").default("created").notNull(),
  aiNeutralDescription: text("ai_neutral_description"),
  acceptedByBoth: boolean("accepted_by_both").default(false).notNull(),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

/* ── Perspectives ── */
export const challengePerspectives = pgTable("challenge_perspectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  perspectiveText: text("perspective_text"),
  submitted: boolean("submitted").default(false).notNull(),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Messages ── */
export const challengeMessages = pgTable("challenge_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull(),
  senderId: text("sender_id").references(() => user.id),
  senderType: senderTypeEnum("sender_type").notNull(),
  content: text("content").notNull(),
  reactions: jsonb("reactions").$type<Record<string, string[]>>(),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Requests & Commitments ── */
export const challengeRequests = pgTable("challenge_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull(),
  requestedBy: text("requested_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  requestText: text("request_text").notNull(),
  category: requestCategoryEnum("category").default("other").notNull(),
  acceptedByPartner: boolean("accepted_by_partner").default(false).notNull(),
  fulfilled: boolean("fulfilled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Attachments ── */
export const challengeAttachments = pgTable("challenge_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull(),
  uploadedBy: text("uploaded_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: fileTypeEnum("file_type").default("other").notNull(),
  originalName: text("original_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Challenge Summaries (AI-generated, Tier 2 memory) ── */
export const challengeSummaries = pgTable("challenge_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  topic: text("topic"),
  recurringThemes: jsonb("recurring_themes").$type<string[]>(),
  partnerAPatterns: jsonb("partner_a_patterns"),
  partnerBPatterns: jsonb("partner_b_patterns"),
  commitmentsMade: jsonb("commitments_made"),
  resolutionApproach: text("resolution_approach"),
  attachmentDynamics: jsonb("attachment_dynamics"),
  growthAreas: jsonb("growth_areas").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Voice Sessions ── */
export const voiceSessions = pgTable("voice_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull(),
  challengeId: uuid("challenge_id").references(() => challenges.id),
  status: voiceSessionStatusEnum("status").default("waiting").notNull(),
  audioRecordingUrl: text("audio_recording_url"),
  aiSessionSummary: text("ai_session_summary"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

/* ── Voice Transcript Segments ── */
export const voiceTranscriptSegments = pgTable("voice_transcript_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => voiceSessions.id, { onDelete: "cascade" })
    .notNull(),
  speakerId: text("speaker_id").references(() => user.id),
  speakerType: speakerTypeEnum("speaker_type").notNull(),
  content: text("content").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Relations ── */
export const challengesRelations = relations(challenges, ({ one, many }) => ({
  couple: one(couples, {
    fields: [challenges.coupleId],
    references: [couples.id],
  }),
  perspectives: many(challengePerspectives),
  messages: many(challengeMessages),
  requests: many(challengeRequests),
  attachments: many(challengeAttachments),
  summary: one(challengeSummaries, {
    fields: [challenges.id],
    references: [challengeSummaries.challengeId],
  }),
}));

export const challengePerspectivesRelations = relations(
  challengePerspectives,
  ({ one }) => ({
    challenge: one(challenges, {
      fields: [challengePerspectives.challengeId],
      references: [challenges.id],
    }),
    user: one(user, {
      fields: [challengePerspectives.userId],
      references: [user.id],
    }),
  })
);

export const challengeMessagesRelations = relations(
  challengeMessages,
  ({ one }) => ({
    challenge: one(challenges, {
      fields: [challengeMessages.challengeId],
      references: [challenges.id],
    }),
    sender: one(user, {
      fields: [challengeMessages.senderId],
      references: [user.id],
    }),
  })
);

export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type ChallengePerspective = typeof challengePerspectives.$inferSelect;
export type ChallengeMessage = typeof challengeMessages.$inferSelect;
export type ChallengeRequest = typeof challengeRequests.$inferSelect;
