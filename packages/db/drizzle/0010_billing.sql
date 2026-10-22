-- The founder offer (krizaka/akinaza#131): the subscription state of an account mirrors the payments processor's
-- notifications; `payment_events` makes each notification apply once. No vendor name in the schema.
ALTER TABLE "accounts" ADD COLUMN "payment_customer_id" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "payment_subscription_id" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "subscription_status" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "current_period_end" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_payment_customer" ON "accounts" ("payment_customer_id") WHERE "payment_customer_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "payment_events" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL
);
