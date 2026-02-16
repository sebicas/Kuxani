DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disagreement_category') THEN CREATE TYPE "public"."disagreement_category" AS ENUM('communication', 'finances', 'intimacy', 'parenting', 'chores', 'boundaries', 'trust', 'other'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disagreement_sender_type') THEN CREATE TYPE "public"."disagreement_sender_type" AS ENUM('user', 'ai', 'system'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disagreement_status') THEN CREATE TYPE "public"."disagreement_status" AS ENUM('intake', 'clarifying', 'confirmed', 'invite_sent', 'partner_joined', 'active', 'resolving', 'resolved'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disagreement_visibility') THEN CREATE TYPE "public"."disagreement_visibility" AS ENUM('private', 'shared'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disagreement_visible_to') THEN CREATE TYPE "public"."disagreement_visible_to" AS ENUM('all', 'creator_only', 'partner_only'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_detail_level') THEN CREATE TYPE "public"."invitation_detail_level" AS ENUM('summary', 'detailed'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'check_in_frequency') THEN CREATE TYPE "public"."check_in_frequency" AS ENUM('daily', 'weekly', 'biweekly', 'monthly', 'none'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commitment_source_type') THEN CREATE TYPE "public"."commitment_source_type" AS ENUM('disagreement', 'challenge', 'manual'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compromise_status') THEN CREATE TYPE "public"."compromise_status" AS ENUM('proposed', 'accepted', 'active', 'fulfilled', 'broken'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_category_commitment') THEN CREATE TYPE "public"."request_category_commitment" AS ENUM('behavior', 'communication', 'emotional', 'practical', 'boundary', 'other'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_priority') THEN CREATE TYPE "public"."request_priority" AS ENUM('low', 'medium', 'high'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN CREATE TYPE "public"."request_status" AS ENUM('proposed', 'accepted', 'declined', 'in_progress', 'fulfilled', 'broken'); END IF; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disagreement_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"disagreement_id" uuid NOT NULL,
	"invited_by" text NOT NULL,
	"invited_user_id" text,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"detail_level" "invitation_detail_level" DEFAULT 'summary' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disagreement_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"disagreement_id" uuid NOT NULL,
	"sender_id" text,
	"sender_type" "disagreement_sender_type" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"visible_to" "disagreement_visible_to" DEFAULT 'all' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disagreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"couple_id" uuid,
	"title" text DEFAULT 'New Disagreement' NOT NULL,
	"visibility" "disagreement_visibility" DEFAULT 'private' NOT NULL,
	"status" "disagreement_status" DEFAULT 'intake' NOT NULL,
	"ai_summary" text,
	"creator_perspective" text,
	"partner_perspective" text,
	"category" "disagreement_category" DEFAULT 'other' NOT NULL,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commitment_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compromise_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compromises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"source_type" "commitment_source_type" DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"proposed_by" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"partner_a_commitment" text NOT NULL,
	"partner_b_commitment" text NOT NULL,
	"status" "compromise_status" DEFAULT 'proposed' NOT NULL,
	"accepted_by_a" boolean DEFAULT false NOT NULL,
	"accepted_by_b" boolean DEFAULT false NOT NULL,
	"check_in_frequency" "check_in_frequency" DEFAULT 'none' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"requested_of" text NOT NULL,
	"source_type" "commitment_source_type" DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"category" "request_category_commitment" DEFAULT 'other' NOT NULL,
	"status" "request_status" DEFAULT 'proposed' NOT NULL,
	"priority" "request_priority" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "disagreement_invitations" ADD CONSTRAINT "disagreement_invitations_disagreement_id_disagreements_id_fk" FOREIGN KEY ("disagreement_id") REFERENCES "public"."disagreements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "disagreement_invitations" ADD CONSTRAINT "disagreement_invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "disagreement_invitations" ADD CONSTRAINT "disagreement_invitations_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "disagreement_messages" ADD CONSTRAINT "disagreement_messages_disagreement_id_disagreements_id_fk" FOREIGN KEY ("disagreement_id") REFERENCES "public"."disagreements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "disagreement_messages" ADD CONSTRAINT "disagreement_messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "disagreements" ADD CONSTRAINT "disagreements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "disagreements" ADD CONSTRAINT "disagreements_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "commitment_check_ins" ADD CONSTRAINT "commitment_check_ins_compromise_id_compromises_id_fk" FOREIGN KEY ("compromise_id") REFERENCES "public"."compromises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "commitment_check_ins" ADD CONSTRAINT "commitment_check_ins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "compromises" ADD CONSTRAINT "compromises_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "compromises" ADD CONSTRAINT "compromises_proposed_by_user_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "requests" ADD CONSTRAINT "requests_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "requests" ADD CONSTRAINT "requests_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "requests" ADD CONSTRAINT "requests_requested_of_user_id_fk" FOREIGN KEY ("requested_of") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;