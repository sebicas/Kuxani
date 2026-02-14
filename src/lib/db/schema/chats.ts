import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

/* ── Enums ── */
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

/* ── Personal Chats ── */
export const personalChats = pgTable("personal_chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").default("New Chat").notNull(),
  isShared: boolean("is_shared").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Personal Messages ── */
export const personalMessages = pgTable("personal_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .references(() => personalChats.id, { onDelete: "cascade" })
    .notNull(),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Relations ── */
export const personalChatsRelations = relations(
  personalChats,
  ({ one, many }) => ({
    user: one(user, {
      fields: [personalChats.userId],
      references: [user.id],
    }),
    messages: many(personalMessages),
  })
);

export const personalMessagesRelations = relations(
  personalMessages,
  ({ one }) => ({
    chat: one(personalChats, {
      fields: [personalMessages.chatId],
      references: [personalChats.id],
    }),
  })
);

export type PersonalChat = typeof personalChats.$inferSelect;
export type PersonalMessage = typeof personalMessages.$inferSelect;
