CREATE TYPE "public"."gratitude_category" AS ENUM('gratitude', 'love_note', 'appreciation');--> statement-breakpoint
CREATE TABLE "deescalation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"couple_id" uuid,
	"trigger_reason" text,
	"breathing_completed" boolean DEFAULT false NOT NULL,
	"cooldown_minutes" integer,
	"ai_prompts_used" jsonb,
	"reflection" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gratitude_entries" ALTER COLUMN "couple_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gratitude_entries" ADD COLUMN "category" "gratitude_category" DEFAULT 'gratitude' NOT NULL;--> statement-breakpoint
ALTER TABLE "gratitude_entries" ADD COLUMN "ai_prompt" text;--> statement-breakpoint
ALTER TABLE "deescalation_sessions" ADD CONSTRAINT "deescalation_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deescalation_sessions" ADD CONSTRAINT "deescalation_sessions_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;