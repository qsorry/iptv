CREATE TABLE "player_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"server_id" uuid,
	"code_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_activity" ADD CONSTRAINT "player_activity_provider_id_content_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."content_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_activity" ADD CONSTRAINT "player_activity_server_id_provider_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."provider_servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_activity" ADD CONSTRAINT "player_activity_code_id_player_activation_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."player_activation_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_activity_created_idx" ON "player_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "player_activity_provider_idx" ON "player_activity" USING btree ("provider_id");