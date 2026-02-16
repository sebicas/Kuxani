import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { couples } from "./couples";

/* ── Enums ── */
export const commitmentSourceTypeEnum = pgEnum("commitment_source_type", [
  "disagreement",
  "challenge",
  "manual",
]);

export const requestCategoryCommitmentEnum = pgEnum(
  "request_category_commitment",
  ["behavior", "communication", "emotional", "practical", "boundary", "other"]
);

export const requestStatusEnum = pgEnum("request_status", [
  "proposed",
  "accepted",
  "declined",
  "in_progress",
  "fulfilled",
  "broken",
]);

export const requestPriorityEnum = pgEnum("request_priority", [
  "low",
  "medium",
  "high",
]);

export const compromiseStatusEnum = pgEnum("compromise_status", [
  "proposed",
  "accepted",
  "active",
  "fulfilled",
  "broken",
]);

export const checkInFrequencyEnum = pgEnum("check_in_frequency", [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "none",
]);

/* ── Requests ── */
export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull(),
  requestedBy: text("requested_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  requestedOf: text("requested_of")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  sourceType: commitmentSourceTypeEnum("source_type")
    .default("manual")
    .notNull(),
  sourceId: uuid("source_id"),
  title: text("title").notNull(),
  description: text("description"),
  category: requestCategoryCommitmentEnum("category")
    .default("other")
    .notNull(),
  status: requestStatusEnum("status").default("proposed").notNull(),
  priority: requestPriorityEnum("priority").default("medium").notNull(),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
});

/* ── Compromises ── */
export const compromises = pgTable("compromises", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .references(() => couples.id, { onDelete: "cascade" })
    .notNull(),
  sourceType: commitmentSourceTypeEnum("source_type")
    .default("manual")
    .notNull(),
  sourceId: uuid("source_id"),
  proposedBy: text("proposed_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  partnerACommitment: text("partner_a_commitment").notNull(),
  partnerBCommitment: text("partner_b_commitment").notNull(),
  status: compromiseStatusEnum("status").default("proposed").notNull(),
  acceptedByA: boolean("accepted_by_a").default(false).notNull(),
  acceptedByB: boolean("accepted_by_b").default(false).notNull(),
  checkInFrequency: checkInFrequencyEnum("check_in_frequency")
    .default("none")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ── Commitment Check-Ins ── */
export const commitmentCheckIns = pgTable("commitment_check_ins", {
  id: uuid("id").primaryKey().defaultRandom(),
  compromiseId: uuid("compromise_id")
    .references(() => compromises.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  rating: integer("rating").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Relations ── */
export const requestsRelations = relations(requests, ({ one }) => ({
  couple: one(couples, {
    fields: [requests.coupleId],
    references: [couples.id],
  }),
  requester: one(user, {
    fields: [requests.requestedBy],
    references: [user.id],
    relationName: "requester",
  }),
  requestee: one(user, {
    fields: [requests.requestedOf],
    references: [user.id],
    relationName: "requestee",
  }),
}));

export const compromisesRelations = relations(
  compromises,
  ({ one, many }) => ({
    couple: one(couples, {
      fields: [compromises.coupleId],
      references: [couples.id],
    }),
    proposer: one(user, {
      fields: [compromises.proposedBy],
      references: [user.id],
    }),
    checkIns: many(commitmentCheckIns),
  })
);

export const commitmentCheckInsRelations = relations(
  commitmentCheckIns,
  ({ one }) => ({
    compromise: one(compromises, {
      fields: [commitmentCheckIns.compromiseId],
      references: [compromises.id],
    }),
    user: one(user, {
      fields: [commitmentCheckIns.userId],
      references: [user.id],
    }),
  })
);

/* ── Type Exports ── */
export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;
export type Compromise = typeof compromises.$inferSelect;
export type NewCompromise = typeof compromises.$inferInsert;
export type CommitmentCheckIn = typeof commitmentCheckIns.$inferSelect;
export type NewCommitmentCheckIn = typeof commitmentCheckIns.$inferInsert;
