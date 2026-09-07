CREATE TYPE "public"."page_template" AS ENUM('article', 'landing');--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "template" "page_template" DEFAULT 'article' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "landing" jsonb;