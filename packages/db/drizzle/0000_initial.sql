CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'USER' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "accounts_email_unique" UNIQUE("email"),
	CONSTRAINT "accounts_email_lower" CHECK ("accounts"."email" = lower("accounts"."email")),
	CONSTRAINT "accounts_role" CHECK ("accounts"."role" IN ('USER','ADMIN')),
	CONSTRAINT "accounts_status" CHECK ("accounts"."status" IN ('ACTIVE','SUSPENDED')),
	CONSTRAINT "accounts_locale" CHECK ("accounts"."locale" IN ('en','fr'))
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"client_id" uuid,
	"service_id" uuid NOT NULL,
	"during" "tstzrange" NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_status" CHECK ("appointments"."status" IN ('booked','done','cancelled','noShow')),
	CONSTRAINT "appointments_bounded" CHECK (NOT isempty("appointments"."during") AND NOT lower_inf("appointments"."during") AND NOT upper_inf("appointments"."during"))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "client_consents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"text_version" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_consents_purpose" CHECK ("client_consents"."purpose" IN ('service','reminders','marketing'))
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"language" text DEFAULT 'fr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"erased_at" timestamp with time zone,
	CONSTRAINT "clients_erased" CHECK ("clients"."erased_at" IS NULL OR ("clients"."email" IS NULL AND "clients"."phone" IS NULL AND "clients"."notes" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"supplier" text NOT NULL,
	"paid_on" date NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"gst_cents" integer NOT NULL,
	"qst_cents" integer NOT NULL,
	"business_share_pct" smallint DEFAULT 100 NOT NULL,
	"receipt_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_share" CHECK ("expenses"."business_share_pct" BETWEEN 0 AND 100),
	CONSTRAINT "expenses_amounts" CHECK ("expenses"."subtotal_cents" >= 0 AND "expenses"."gst_cents" >= 0 AND "expenses"."qst_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	CONSTRAINT "invoice_lines_amount" CHECK ("invoice_lines"."amount_cents" = "invoice_lines"."quantity" * "invoice_lines"."unit_price_cents" - "invoice_lines"."discount_cents")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"number" text NOT NULL,
	"client_id" uuid,
	"appointment_id" uuid,
	"credit_of" uuid,
	"language" text DEFAULT 'fr' NOT NULL,
	"issued_on" date NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"gst_cents" integer NOT NULL,
	"qst_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_total" CHECK ("invoices"."total_cents" = "invoices"."subtotal_cents" + "invoices"."gst_cents" + "invoices"."qst_cents"),
	CONSTRAINT "invoices_language" CHECK ("invoices"."language" IN ('fr','en'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"method" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_method" CHECK ("payments"."method" IN ('cash','card','transfer','other'))
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	CONSTRAINT "schedules_weekday" CHECK ("schedules"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "schedules_hours" CHECK ("schedules"."ends_at" > "schedules"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name_fr" text NOT NULL,
	"name_en" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"tax_category" text DEFAULT 'standard' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "services_duration" CHECK ("services"."duration_minutes" BETWEEN 5 AND 600),
	CONSTRAINT "services_price" CHECK ("services"."price_cents" >= 0),
	CONSTRAINT "services_tax_category" CHECK ("services"."tax_category" IN ('standard','zeroRated','exempt'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"legal_name" text NOT NULL,
	"kind" text NOT NULL,
	"registrant" boolean DEFAULT true NOT NULL,
	"gst_number" text,
	"qst_number" text,
	"address" text NOT NULL,
	"timezone" text DEFAULT 'America/Toronto' NOT NULL,
	"invoice_prefix" text DEFAULT 'F' NOT NULL,
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_kind" CHECK ("shops"."kind" IN ('salon','bakery','cafe','boutique','services','other')),
	CONSTRAINT "shops_tax_numbers" CHECK (NOT "shops"."registrant" OR (coalesce("shops"."gst_number", '') ~ '^[0-9]{9}RT[0-9]{4}$' AND coalesce("shops"."qst_number", '') ~ '^[0-9]{10}TQ[0-9]{4}$'))
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"period" date NOT NULL,
	"tax" text NOT NULL,
	"direction" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_label" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_ledger_period_month" CHECK (extract(day from "tax_ledger"."period") = 1),
	CONSTRAINT "tax_ledger_tax" CHECK ("tax_ledger"."tax" IN ('gst','qst')),
	CONSTRAINT "tax_ledger_direction" CHECK ("tax_ledger"."direction" IN ('collected','credit')),
	CONSTRAINT "tax_ledger_source_direction" CHECK (("tax_ledger"."source_kind" = 'invoice' AND "tax_ledger"."direction" = 'collected') OR ("tax_ledger"."source_kind" = 'expense' AND "tax_ledger"."direction" = 'credit'))
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_ledger" ADD CONSTRAINT "tax_ledger_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_shop" ON "appointments" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "audit_log_at" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "clients_shop" ON "clients" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_position" ON "invoice_lines" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number" ON "invoices" USING btree ("shop_id","number");--> statement-breakpoint
CREATE INDEX "sessions_account" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tax_ledger_period" ON "tax_ledger" USING btree ("shop_id","period");--> statement-breakpoint
CREATE INDEX "tax_ledger_source" ON "tax_ledger" USING btree ("source_kind","source_id");