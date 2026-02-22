import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { relationshipStageEnum, livingSituationEnum } from "./intake";

/* ── Enums ── */
export const coupleStatusEnum = pgEnum("couple_status", [
  "pending",
  "active",
  "paused",
  "ended",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "creator",
  "partner",
]);

/* ── Couples ── */
export const couples = pgTable("couples", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  inviteCode: text("invite_code").notNull().unique(),
  status: coupleStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Couple Members (junction) ── */
export const coupleMembers = pgTable("couple_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  role: memberRoleEnum("role").default("creator").notNull(),
  colorCode: text("color_code").default("#6366f1").notNull(),
});

/* ── Couple Profile (AI-maintained + intake data) ── */
export const coupleProfiles = pgTable("couple_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  communicationPatterns: jsonb("communication_patterns"),
  commonTriggers: jsonb("common_triggers"),
  loveLanguages: jsonb("love_languages"),
  effectiveStrategies: jsonb("effective_strategies"),
  recentWins: jsonb("recent_wins"),
  /* ── Intake: Relationship Context (couple-level facts) ── */
  relationshipStage: relationshipStageEnum("relationship_stage"),
  togetherSince: date("together_since"),
  currentStageSince: date("current_stage_since"),
  livingSituation: livingSituationEnum("living_situation"),
  children: jsonb("children").$type<
    { name: string; age: number; relationship: "bio" | "step" | "adopted" }[]
  >(),
  therapyGoals: jsonb("therapy_goals").$type<string[]>(),
  previousTherapy: jsonb("previous_therapy").$type<{
    type?: string;
    duration?: string;
    whatHelped?: string;
    whatDidnt?: string;
  }>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ── Relations ── */
export const couplesRelations = relations(couples, ({ many, one }) => ({
  members: many(coupleMembers),
  profile: one(coupleProfiles, {
    fields: [couples.id],
    references: [coupleProfiles.coupleId],
  }),
}));

export const coupleMembersRelations = relations(coupleMembers, ({ one }) => ({
  couple: one(couples, {
    fields: [coupleMembers.coupleId],
    references: [couples.id],
  }),
  user: one(user, {
    fields: [coupleMembers.userId],
    references: [user.id],
  }),
}));

export type Couple = typeof couples.$inferSelect;
export type NewCouple = typeof couples.$inferInsert;
export type CoupleMember = typeof coupleMembers.$inferSelect;
export type CoupleProfile = typeof coupleProfiles.$inferSelect;
