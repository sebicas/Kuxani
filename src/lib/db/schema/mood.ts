import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { couples } from "./couples";

/* ── Mood Entries ── */
export const moodEntries = pgTable("mood_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  primaryEmotion: text("primary_emotion").notNull(),
  secondaryEmotion: text("secondary_emotion"),
  intensity: integer("intensity").notNull(), // 1-10
  notes: text("notes"),
  sharedWithPartner: boolean("shared_with_partner").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Gratitude Category ── */
export const gratitudeCategoryEnum = pgEnum("gratitude_category", [
  "gratitude",
  "love_note",
  "appreciation",
]);

/* ── Gratitude Entries ── */
export const gratitudeEntries = pgTable("gratitude_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  coupleId: uuid("couple_id").references(() => couples.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(),
  category: gratitudeCategoryEnum("category").default("gratitude").notNull(),
  aiPrompt: text("ai_prompt"),
  shared: boolean("shared").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Love Language Results ── */
export const loveLanguageResults = pgTable("love_language_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  wordsOfAffirmation: integer("words_of_affirmation").notNull(),
  actsOfService: integer("acts_of_service").notNull(),
  receivingGifts: integer("receiving_gifts").notNull(),
  qualityTime: integer("quality_time").notNull(),
  physicalTouch: integer("physical_touch").notNull(),
  answers: jsonb("answers"), // Raw quiz answers: ["W","A","Q",...] (30 elements)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Relations ── */
export const moodEntriesRelations = relations(moodEntries, ({ one }) => ({
  user: one(user, {
    fields: [moodEntries.userId],
    references: [user.id],
  }),
}));

export const gratitudeEntriesRelations = relations(
  gratitudeEntries,
  ({ one }) => ({
    user: one(user, {
      fields: [gratitudeEntries.userId],
      references: [user.id],
    }),
    couple: one(couples, {
      fields: [gratitudeEntries.coupleId],
      references: [couples.id],
    }),
  })
);

export const loveLanguageResultsRelations = relations(
  loveLanguageResults,
  ({ one }) => ({
    user: one(user, {
      fields: [loveLanguageResults.userId],
      references: [user.id],
    }),
  })
);

/* ── Attachment Style Results ── */
export const attachmentStyleResults = pgTable("attachment_style_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  secure: integer("secure").notNull(),
  anxious: integer("anxious").notNull(),
  avoidant: integer("avoidant").notNull(),
  fearfulAvoidant: integer("fearful_avoidant").notNull(),
  answers: jsonb("answers"), // Raw quiz answers: [4,6,2,...] (40 elements, 1-7 Likert scale)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attachmentStyleResultsRelations = relations(
  attachmentStyleResults,
  ({ one }) => ({
    user: one(user, {
      fields: [attachmentStyleResults.userId],
      references: [user.id],
    }),
  })
);

export type MoodEntry = typeof moodEntries.$inferSelect;
export type GratitudeEntry = typeof gratitudeEntries.$inferSelect;
export type LoveLanguageResult = typeof loveLanguageResults.$inferSelect;
export type AttachmentStyleResult = typeof attachmentStyleResults.$inferSelect;
