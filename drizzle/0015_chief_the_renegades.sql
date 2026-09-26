CREATE TABLE "content_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"cr_number" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"approved_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'document' NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"has_expiry" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_requirements_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "provider_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"status" text DEFAULT 'missing' NOT NULL,
	"reference" text,
	"expires_at" timestamp with time zone,
	"reviewer_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_submissions" ADD CONSTRAINT "provider_submissions_provider_id_content_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."content_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_submissions" ADD CONSTRAINT "provider_submissions_requirement_id_provider_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."provider_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_providers_status_idx" ON "content_providers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_submissions_provider_requirement_idx" ON "provider_submissions" USING btree ("provider_id","requirement_id");