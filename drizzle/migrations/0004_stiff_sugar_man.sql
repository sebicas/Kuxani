CREATE TYPE "public"."childhood_wound_source" AS ENUM('self', 'partner', 'ai');--> statement-breakpoint
CREATE TYPE "public"."childhood_wound_status" AS ENUM('active', 'suggested', 'dismissed');--> statement-breakpoint
CREATE TABLE "childhood_wounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"intensity" integer DEFAULT 5 NOT NULL,
	"source" "childhood_wound_source" DEFAULT 'self' NOT NULL,
	"suggested_by" text,
	"status" "childhood_wound_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "childhood_wounds" ADD CONSTRAINT "childhood_wounds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "childhood_wounds" ADD CONSTRAINT "childhood_wounds_suggested_by_user_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;