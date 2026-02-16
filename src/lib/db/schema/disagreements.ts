import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { couples } from "./couples";

/* ── Enums ── */
export const disagreementCategoryEnum = pgEnum("disagreement_category", [
  "communication",
  "finances",
  "intimacy",
  "parenting",
  "chores",
  "boundaries",
  "trust",
  "other",
]);

export const disagreementStatusEnum = pgEnum("disagreement_status", [
  "intake",
  "clarifying",
  "confirmed",
  "invite_sent",
  "partner_joined",
  "active",
  "resolving",
  "resolved",
]);

export const disagreementVisibilityEnum = pgEnum("disagreement_visibility", [
  "private",
  "shared",
]);

export const disagreementSenderTypeEnum = pgEnum("disagreement_sender_type", [
  "user",
  "ai",
  "system",
]);

export const disagreementVisibleToEnum = pgEnum("disagreement_visible_to", [
  "all",
  "creator_only",
  "partner_only",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
]);

export const invitationDetailLevelEnum = pgEnum("invitation_detail_level", [
  "summary",
  "detailed",
]);

/* ── Disagreements ── */
export const disagreements = pgTable("disagreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  coupleId: uuid("couple_id").references(() => couples.id, {
    onDelete: "cascade",
  }),
  title: text("title").default("New Disagreement").notNull(),
  visibility: disagreementVisibilityEnum("visibility")
    .default("private")
    .notNull(),
  status: disagreementStatusEnum("status").default("intake").notNull(),
  aiSummary: text("ai_summary"),
  creatorPerspective: text("creator_perspective"),
  partnerPerspective: text("partner_perspective"),
  category: disagreementCategoryEnum("category").default("other").notNull(),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

/* ── Disagreement Messages ── */
export const disagreementMessages = pgTable("disagreement_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  disagreementId: uuid("disagreement_id")
    .references(() => disagreements.id, { onDelete: "cascade" })
    .notNull(),
  senderId: text("sender_id").references(() => user.id),
  senderType: disagreementSenderTypeEnum("sender_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  visibleTo: disagreementVisibleToEnum("visible_to").default("all").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Disagreement Invitations ── */
export const disagreementInvitations = pgTable("disagreement_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  disagreementId: uuid("disagreement_id")
    .references(() => disagreements.id, { onDelete: "cascade" })
    .notNull(),
  invitedBy: text("invited_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  invitedUserId: text("invited_user_id").references(() => user.id),
  status: invitationStatusEnum("status").default("pending").notNull(),
  detailLevel: invitationDetailLevelEnum("detail_level")
    .default("summary")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

/* ── Relations ── */
export const disagreementsRelations = relations(
  disagreements,
  ({ one, many }) => ({
    creator: one(user, {
      fields: [disagreements.userId],
      references: [user.id],
    }),
    couple: one(couples, {
      fields: [disagreements.coupleId],
      references: [couples.id],
    }),
    messages: many(disagreementMessages),
    invitations: many(disagreementInvitations),
  })
);

export const disagreementMessagesRelations = relations(
  disagreementMessages,
  ({ one }) => ({
    disagreement: one(disagreements, {
      fields: [disagreementMessages.disagreementId],
      references: [disagreements.id],
    }),
    sender: one(user, {
      fields: [disagreementMessages.senderId],
      references: [user.id],
    }),
  })
);

export const disagreementInvitationsRelations = relations(
  disagreementInvitations,
  ({ one }) => ({
    disagreement: one(disagreements, {
      fields: [disagreementInvitations.disagreementId],
      references: [disagreements.id],
    }),
    inviter: one(user, {
      fields: [disagreementInvitations.invitedBy],
      references: [user.id],
      relationName: "inviter",
    }),
    invitee: one(user, {
      fields: [disagreementInvitations.invitedUserId],
      references: [user.id],
      relationName: "invitee",
    }),
  })
);

/* ── Type Exports ── */
export type Disagreement = typeof disagreements.$inferSelect;
export type NewDisagreement = typeof disagreements.$inferInsert;
export type DisagreementMessage = typeof disagreementMessages.$inferSelect;
export type NewDisagreementMessage = typeof disagreementMessages.$inferInsert;
export type DisagreementInvitation =
  typeof disagreementInvitations.$inferSelect;
