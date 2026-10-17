-- Social and listings sync (docs/adr/ADR-002-social-sync.md): the owner's connections to Google, Facebook and Instagram
-- (tokens sealed by the application, never readable here), the proposals a pull produces and the owner decides field by
-- field, and the append-only log of what was read, decided and sent.

ALTER TABLE "shops" ADD COLUMN "public_website" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_public_website" CHECK (length(coalesce("public_website", '')) <= 200);
--> statement-breakpoint
CREATE TABLE "social_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "status" text DEFAULT 'connected' NOT NULL,
  "external_id" text,
  "external_label" text,
  "scopes" text[] DEFAULT '{}'::text[] NOT NULL,
  "token_enc" text,
  "consent_text_version" text NOT NULL,
  "consented_at" timestamp with time zone DEFAULT now() NOT NULL,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_sync_at" timestamp with time zone,
  "last_error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_connections_platform" CHECK ("platform" IN ('google','facebook','instagram')),
  CONSTRAINT "social_connections_status" CHECK ("status" IN ('connected','needs_reconnect','disconnected')),
  CONSTRAINT "social_connections_token" CHECK ("status" <> 'connected' OR "token_enc" IS NOT NULL),
  CONSTRAINT "social_connections_disconnected_wiped" CHECK ("status" <> 'disconnected' OR "token_enc" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_connections_shop_platform" ON "social_connections" ("shop_id", "platform");
--> statement-breakpoint
CREATE TABLE "sync_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone,
  CONSTRAINT "sync_proposals_platform" CHECK ("platform" IN ('google','facebook','instagram')),
  CONSTRAINT "sync_proposals_status" CHECK ("status" IN ('open','decided','superseded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sync_proposals_one_open" ON "sync_proposals" ("shop_id", "platform") WHERE "status" = 'open';
--> statement-breakpoint
CREATE TABLE "sync_proposal_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "proposal_id" uuid NOT NULL REFERENCES "sync_proposals"("id") ON DELETE CASCADE,
  "field" text NOT NULL,
  "state" text NOT NULL,
  "local_value" jsonb,
  "remote_value" jsonb,
  "decision" text DEFAULT 'pending' NOT NULL,
  "pushed_at" timestamp with time zone,
  CONSTRAINT "sync_proposal_items_field" CHECK ("field" IN ('hours','description','phone','email','website')),
  CONSTRAINT "sync_proposal_items_state" CHECK ("state" IN ('changed','remote_only','local_only')),
  CONSTRAINT "sync_proposal_items_decision" CHECK ("decision" IN ('pending','accept','keep'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sync_proposal_items_field" ON "sync_proposal_items" ("proposal_id", "field");
--> statement-breakpoint
CREATE TABLE "sync_log" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "field" text,
  "direction" text NOT NULL,
  "outcome" text NOT NULL,
  "at" timestamp with time zone DEFAULT now() NOT NULL,
  "detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "sync_log_direction" CHECK ("direction" IN ('pull','push','connection')),
  CONSTRAINT "sync_log_outcome" CHECK ("outcome" IN ('connected','disconnected','proposed','accepted','kept_local','pushed','skipped','failed'))
);
--> statement-breakpoint
CREATE INDEX "sync_log_shop_at" ON "sync_log" ("shop_id", "at" DESC);
--> statement-breakpoint
CREATE FUNCTION ak_sync_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AK_WRITTEN_ONCE: sync_log rows are never updated';
END $$;
--> statement-breakpoint
CREATE TRIGGER sync_log_immutable BEFORE UPDATE ON "sync_log" FOR EACH ROW EXECUTE FUNCTION ak_sync_log_immutable();
