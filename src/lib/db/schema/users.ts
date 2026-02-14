import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  emailVerified: timestamp("email_verified"),
  profileData: jsonb("profile_data").$type<{
    attachmentStyle?: string;
    triggers?: string[];
    copingMechanisms?: string[];
    growthAreas?: string[];
    loveLanguage?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
