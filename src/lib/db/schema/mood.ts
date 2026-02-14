import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
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

/* ── Gratitude Entries ── */
export const gratitudeEntries = pgTable("gratitude_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
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

export type MoodEntry = typeof moodEntries.$inferSelect;
export type GratitudeEntry = typeof gratitudeEntries.$inferSelect;
export type LoveLanguageResult = typeof loveLanguageResults.$inferSelect;
