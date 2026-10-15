-- Password reset: a one-time link, kept only as its hash, valid for 30 minutes. Used once; a reset ends every session.
CREATE TABLE "password_resets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "password_resets_account" ON "password_resets" ("account_id");
