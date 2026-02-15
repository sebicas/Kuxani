CREATE TABLE "attachment_style_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"secure" integer NOT NULL,
	"anxious" integer NOT NULL,
	"avoidant" integer NOT NULL,
	"fearful_avoidant" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachment_style_results" ADD CONSTRAINT "attachment_style_results_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;