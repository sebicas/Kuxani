import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { couples } from "./couples";

/* ── Enums ── */
export const intakePhaseStatusEnum = pgEnum("intake_phase_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const intakeModalityEnum = pgEnum("intake_modality", [
  "voice",
  "form",
  "chat",
]);

export const relationshipStageEnum = pgEnum("relationship_stage", [
  "dating",
  "engaged",
  "married",
  "separated",
  "divorced",
  "reconciling",
]);

export const livingSituationEnum = pgEnum("living_situation", [
  "together",
  "apart",
  "long_distance",
]);

/* ── Intake Progress (per-user, per-phase tracking) ── */
export const intakeProgress = pgTable("intake_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  coupleId: uuid("couple_id").references(() => couples.id, {
    onDelete: "cascade",
  }),
  phase: integer("phase").notNull(), // 1-7
  status: intakePhaseStatusEnum("status").default("not_started").notNull(),
  modalityUsed: intakeModalityEnum("modality_used"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  rawTranscript: text("raw_transcript"), // voice/chat transcript for re-extraction
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/* ── Intake Responses (dual-perspective answers per field) ── */
export const intakeResponses = pgTable("intake_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull(),
  phase: integer("phase").notNull(), // 1-7
  field: text("field").notNull(), // e.g. "presenting_problem", "conflict_pattern"
  value: jsonb("value").notNull(), // arbitrary JSON value for this field
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/* ── Relations ── */
export const intakeProgressRelations = relations(
  intakeProgress,
  ({ one }) => ({
    user: one(user, {
      fields: [intakeProgress.userId],
      references: [user.id],
    }),
    couple: one(couples, {
      fields: [intakeProgress.coupleId],
      references: [couples.id],
    }),
  })
);

export const intakeResponsesRelations = relations(
  intakeResponses,
  ({ one }) => ({
    user: one(user, {
      fields: [intakeResponses.userId],
      references: [user.id],
    }),
    couple: one(couples, {
      fields: [intakeResponses.coupleId],
      references: [couples.id],
    }),
  })
);

/* ── Type exports ── */
export type IntakeProgress = typeof intakeProgress.$inferSelect;
export type NewIntakeProgress = typeof intakeProgress.$inferInsert;
export type IntakeResponse = typeof intakeResponses.$inferSelect;
export type NewIntakeResponse = typeof intakeResponses.$inferInsert;
