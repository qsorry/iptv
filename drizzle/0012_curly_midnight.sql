CREATE TYPE "public"."tracking_delivery_status" AS ENUM('sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."tracking_event_status" AS ENUM('pending', 'sent', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"visitor_key" text NOT NULL,
	"analytics" boolean DEFAULT false NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secrets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_event_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"status" "tracking_delivery_status" NOT NULL,
	"status_code" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"dedupe_key" text,
	"event_time" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "tracking_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"visitor_key" text NOT NULL,
	"customer_id" uuid,
	"first_touch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_touch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "visitor_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_term" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fbclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ttclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sccid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "msclkid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "referrer" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "landing_page" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "device" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "first_touch" jsonb;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_deliveries" ADD CONSTRAINT "tracking_deliveries_tracking_event_id_tracking_events_id_fk" FOREIGN KEY ("tracking_event_id") REFERENCES "public"."tracking_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_deliveries" ADD CONSTRAINT "tracking_deliveries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_records_store_visitor_idx" ON "consent_records" USING btree ("store_id","visitor_key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_settings_store_platform_idx" ON "integration_settings" USING btree ("store_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_deliveries_event_platform_idx" ON "tracking_deliveries" USING btree ("tracking_event_id","platform");--> statement-breakpoint
CREATE INDEX "tracking_deliveries_store_idx" ON "tracking_deliveries" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_events_dedupe_idx" ON "tracking_events" USING btree ("store_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "tracking_events_queue_idx" ON "tracking_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "tracking_events_store_idx" ON "tracking_events" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "visitors_store_key_idx" ON "visitors" USING btree ("store_id","visitor_key");--> statement-breakpoint
CREATE INDEX "visitors_store_seen_idx" ON "visitors" USING btree ("store_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "orders_store_source_idx" ON "orders" USING btree ("store_id","utm_source");