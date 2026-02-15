import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

/* ── Enums ── */
export const childhoodWoundSourceEnum = pgEnum("childhood_wound_source", [
  "self",
  "partner",
  "ai",
]);

export const childhoodWoundStatusEnum = pgEnum("childhood_wound_status", [
  "active",
  "suggested",
  "dismissed",
]);

/* ── Childhood Wounds ── */
export const childhoodWounds = pgTable("childhood_wounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  intensity: integer("intensity").default(5).notNull(), // 1-10 trauma intensity
  source: childhoodWoundSourceEnum("source").default("self").notNull(),
  suggestedBy: text("suggested_by").references(() => user.id, {
    onDelete: "set null",
  }),
  status: childhoodWoundStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/* ── Relations ── */
export const childhoodWoundsRelations = relations(
  childhoodWounds,
  ({ one }) => ({
    user: one(user, {
      fields: [childhoodWounds.userId],
      references: [user.id],
      relationName: "childhoodWoundOwner",
    }),
    suggestedByUser: one(user, {
      fields: [childhoodWounds.suggestedBy],
      references: [user.id],
      relationName: "childhoodWoundSuggester",
    }),
  })
);

/* ── Type exports ── */
export type ChildhoodWound = typeof childhoodWounds.$inferSelect;
export type NewChildhoodWound = typeof childhoodWounds.$inferInsert;
