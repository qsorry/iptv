CREATE TYPE "public"."merchant_sync_status" AS ENUM('pending', 'pending_delete', 'synced', 'failed', 'disapproved', 'deleted');--> statement-breakpoint
CREATE TABLE "merchant_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"offer_id" text NOT NULL,
	"google_id" text NOT NULL,
	"status" "merchant_sync_status" DEFAULT 'pending' NOT NULL,
	"payload_hash" text,
	"last_synced_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"issues" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_sync_state" ADD CONSTRAINT "merchant_sync_state_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_sync_store_product_idx" ON "merchant_sync_state" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "merchant_sync_queue_idx" ON "merchant_sync_state" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "merchant_sync_store_status_idx" ON "merchant_sync_state" USING btree ("store_id","status");