CREATE TYPE "public"."code_status" AS ENUM('available', 'reserved', 'delivered', 'disabled');--> statement-breakpoint
CREATE TABLE "digital_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "code_status" DEFAULT 'available' NOT NULL,
	"order_id" uuid,
	"order_item_id" uuid,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digital_codes_store_code_idx" ON "digital_codes" USING btree ("store_id","code");--> statement-breakpoint
CREATE INDEX "digital_codes_variant_status_idx" ON "digital_codes" USING btree ("variant_id","status");--> statement-breakpoint
CREATE INDEX "digital_codes_order_idx" ON "digital_codes" USING btree ("order_id");