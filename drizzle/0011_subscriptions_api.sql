CREATE TYPE "public"."provision_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "subscription_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"package_id" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"preset" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_provisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"variant_id" uuid,
	"provider_id" uuid,
	"status" "provision_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"request" jsonb,
	"response" jsonb,
	"credentials" jsonb,
	"delivered_code" text,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_mappings" ADD CONSTRAINT "subscription_mappings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_mappings" ADD CONSTRAINT "subscription_mappings_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_mappings" ADD CONSTRAINT "subscription_mappings_provider_id_subscription_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."subscription_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_providers" ADD CONSTRAINT "subscription_providers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_provisions" ADD CONSTRAINT "subscription_provisions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_provisions" ADD CONSTRAINT "subscription_provisions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_provisions" ADD CONSTRAINT "subscription_provisions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_provisions" ADD CONSTRAINT "subscription_provisions_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_provisions" ADD CONSTRAINT "subscription_provisions_provider_id_subscription_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."subscription_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_mappings_variant_idx" ON "subscription_mappings" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "subscription_mappings_store_idx" ON "subscription_mappings" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "subscription_providers_store_idx" ON "subscription_providers" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_provisions_item_seq_idx" ON "subscription_provisions" USING btree ("order_item_id","sequence");--> statement-breakpoint
CREATE INDEX "subscription_provisions_store_status_idx" ON "subscription_provisions" USING btree ("store_id","status","created_at");--> statement-breakpoint
CREATE INDEX "subscription_provisions_order_idx" ON "subscription_provisions" USING btree ("order_id");