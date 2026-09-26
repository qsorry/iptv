CREATE TABLE "player_activation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"server_id" uuid NOT NULL,
	"username" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"last_redeemed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_activation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "player_pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"poll_token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload_encrypted" text,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_pairings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "provider_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"label" text NOT NULL,
	"base_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_username_prefixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_username_prefixes_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
ALTER TABLE "player_activation_codes" ADD CONSTRAINT "player_activation_codes_server_id_provider_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."provider_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_servers" ADD CONSTRAINT "provider_servers_provider_id_content_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."content_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_username_prefixes" ADD CONSTRAINT "provider_username_prefixes_server_id_provider_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."provider_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_activation_codes_server_idx" ON "player_activation_codes" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "player_pairings_expires_idx" ON "player_pairings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "provider_servers_provider_idx" ON "provider_servers" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "provider_username_prefixes_server_idx" ON "provider_username_prefixes" USING btree ("server_id");