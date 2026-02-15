/**
 * De-escalation Sessions Schema
 *
 * Tracks emergency de-escalation sessions including breathing exercises,
 * cooling periods, AI prompts used, and trigger/reflection data.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { couples } from "./couples";

/* ── De-escalation Sessions ── */
export const deescalationSessions = pgTable("deescalation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  coupleId: uuid("couple_id").references(() => couples.id, {
    onDelete: "cascade",
  }),
  triggerReason: text("trigger_reason"),
  breathingCompleted: boolean("breathing_completed").default(false).notNull(),
  cooldownMinutes: integer("cooldown_minutes"),
  aiPromptsUsed: jsonb("ai_prompts_used").$type<string[]>(),
  reflection: text("reflection"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Relations ── */
export const deescalationSessionsRelations = relations(
  deescalationSessions,
  ({ one }) => ({
    user: one(user, {
      fields: [deescalationSessions.userId],
      references: [user.id],
    }),
    couple: one(couples, {
      fields: [deescalationSessions.coupleId],
      references: [couples.id],
    }),
  })
);

export type DeescalationSession = typeof deescalationSessions.$inferSelect;
