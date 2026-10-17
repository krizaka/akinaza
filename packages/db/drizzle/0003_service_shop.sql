-- The generic service-shop model (docs/adr/ADR-001-service-shop-model.md): a public shop page, zones, capacity,
-- days off, per-shop rules (data, not constants), the client's sign-in link and encrypted access notes, dependants,
-- bookings with their seats, visit check-in/out, visit reports with their photo, and the outgoing mail.

-- 1. The shop page and its zones.
ALTER TABLE "shops" ADD COLUMN "slug" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "published" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "tagline_fr" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "tagline_en" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_slug_format" CHECK ("slug" IS NULL OR ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") BETWEEN 3 AND 40));
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_published_has_slug" CHECK (NOT "published" OR "slug" IS NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX "shops_slug" ON "shops" ("slug") WHERE "slug" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "shop_zones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "shop_zones_name" CHECK (length(btrim("name")) BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shop_zones_name_per_shop" ON "shop_zones" ("shop_id", lower("name"));
--> statement-breakpoint

-- 2. Capacity: the most dependants one visit of a service takes (1 = individual, N = group).
ALTER TABLE "services" ADD COLUMN "capacity" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_capacity" CHECK ("capacity" BETWEEN 1 AND 50);
--> statement-breakpoint

-- 3. Days off, and the shop's own rules (defaults are the version 1; bounds are repeated by the application's schema).
CREATE TABLE "days_off" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "on_date" date NOT NULL,
  "reason" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "days_off_staff_day" ON "days_off" ("staff_id", "on_date");
--> statement-breakpoint
CREATE TABLE "shop_rules" (
  "shop_id" uuid PRIMARY KEY REFERENCES "shops"("id") ON DELETE CASCADE,
  "cancellation_hours" integer DEFAULT 24 NOT NULL,
  "booking_horizon_days" integer DEFAULT 60 NOT NULL,
  "slot_step_minutes" integer DEFAULT 30 NOT NULL,
  "min_notice_minutes" integer DEFAULT 120 NOT NULL,
  "report_link_days" integer DEFAULT 30 NOT NULL,
  CONSTRAINT "shop_rules_cancellation" CHECK ("cancellation_hours" BETWEEN 0 AND 168),
  CONSTRAINT "shop_rules_horizon" CHECK ("booking_horizon_days" BETWEEN 1 AND 180),
  CONSTRAINT "shop_rules_step" CHECK ("slot_step_minutes" BETWEEN 5 AND 240),
  CONSTRAINT "shop_rules_notice" CHECK ("min_notice_minutes" BETWEEN 0 AND 10080),
  CONSTRAINT "shop_rules_link" CHECK ("report_link_days" BETWEEN 1 AND 365)
);
--> statement-breakpoint

-- 4. A client file can belong to a signed-in account; its access notes (keys, door codes) are ciphertext.
ALTER TABLE "clients" ADD COLUMN "account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "access_notes_enc" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "clients_account_per_shop" ON "clients" ("shop_id", "account_id") WHERE "account_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_erased";
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_erased" CHECK ("erased_at" IS NULL OR ("email" IS NULL AND "phone" IS NULL AND "notes" IS NULL AND "access_notes_enc" IS NULL AND "account_id" IS NULL));
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_access_notes_sealed" CHECK ("access_notes_enc" IS NULL OR "access_notes_enc" ~ '^v[0-9]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$');
--> statement-breakpoint

-- 5. Dependants (a dog, a cat…): the vertical's details are a validated JSON profile, erased with the client.
CREATE TABLE "dependants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "erased_at" timestamp with time zone,
  CONSTRAINT "dependants_kind" CHECK ("kind" IN ('dog','cat','other')),
  CONSTRAINT "dependants_erased" CHECK ("erased_at" IS NULL OR ("name" = '—' AND "profile" = '{}'::jsonb))
);
--> statement-breakpoint
CREATE INDEX "dependants_client" ON "dependants" ("client_id");
--> statement-breakpoint

-- 6. A visit knows its zone and when it started and ended.
ALTER TABLE "appointments" ADD COLUMN "zone_id" uuid REFERENCES "shop_zones"("id");
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "checked_in_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "checked_out_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_check_order" CHECK ("checked_out_at" IS NULL OR ("checked_in_at" IS NOT NULL AND "checked_out_at" >= "checked_in_at"));
--> statement-breakpoint

-- 7. Bookings: one dependant's seat on a visit.
CREATE TABLE "bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "appointment_id" uuid NOT NULL REFERENCES "appointments"("id"),
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "dependant_id" uuid NOT NULL REFERENCES "dependants"("id"),
  "status" text DEFAULT 'booked' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cancelled_at" timestamp with time zone,
  CONSTRAINT "bookings_status" CHECK ("status" IN ('booked','cancelled')),
  CONSTRAINT "bookings_cancelled" CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_one_seat" ON "bookings" ("appointment_id", "dependant_id") WHERE "status" = 'booked';
--> statement-breakpoint
CREATE INDEX "bookings_client" ON "bookings" ("client_id");
--> statement-breakpoint
-- The database counts the seats: a visit never holds more dependants than its service's capacity, and a booking only
-- ever joins the shop's own client and that client's own dependant. The visit row is locked so two bookings queue.
CREATE FUNCTION ak_booking_rules() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  taken integer;
  visit_shop uuid;
BEGIN
  IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
  SELECT a.shop_id, s.capacity INTO visit_shop, cap
    FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.id = NEW.appointment_id FOR UPDATE OF a;
  IF NOT EXISTS (SELECT 1 FROM clients c JOIN dependants d ON d.client_id = c.id
                  WHERE c.id = NEW.client_id AND d.id = NEW.dependant_id AND c.shop_id = visit_shop AND c.erased_at IS NULL) THEN
    RAISE EXCEPTION 'AK_BOOKING_OWNERSHIP: dependant % is not a dependant of client % of this shop', NEW.dependant_id, NEW.client_id;
  END IF;
  SELECT count(*) INTO taken FROM bookings WHERE appointment_id = NEW.appointment_id AND status = 'booked' AND id <> NEW.id;
  IF taken >= cap THEN
    RAISE EXCEPTION 'AK_CAPACITY_FULL: visit % takes % and has % booked', NEW.appointment_id, cap, taken;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER bookings_rules BEFORE INSERT OR UPDATE OF status ON bookings FOR EACH ROW EXECUTE FUNCTION ak_booking_rules();
--> statement-breakpoint

-- 8. The visit report of a booking: a note, a photo (resized JPEG/PNG/WebP, 1.5 MB at most), its private link.
CREATE TABLE "visit_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL UNIQUE REFERENCES "bookings"("id"),
  "note" text NOT NULL,
  "photo" bytea,
  "photo_type" text,
  "duration_minutes" integer NOT NULL,
  "view_token_hash" text NOT NULL UNIQUE,
  "token_expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  CONSTRAINT "visit_reports_note" CHECK (length("note") BETWEEN 1 AND 1000),
  CONSTRAINT "visit_reports_photo_type" CHECK (("photo" IS NULL) = ("photo_type" IS NULL) AND ("photo_type" IS NULL OR "photo_type" IN ('jpeg','png','webp'))),
  CONSTRAINT "visit_reports_photo_size" CHECK ("photo" IS NULL OR octet_length("photo") <= 1572864),
  CONSTRAINT "visit_reports_duration" CHECK ("duration_minutes" BETWEEN 1 AND 1440)
);
--> statement-breakpoint

-- 9. What Akinaza said to whom, rendered; delivered by the mail provider when one is configured (fails closed: pending).
CREATE TABLE "mail_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "to_email" text NOT NULL,
  "locale" text DEFAULT 'fr' NOT NULL,
  "template" text NOT NULL,
  "subject" text NOT NULL,
  "html" text NOT NULL,
  "body_text" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "related_kind" text,
  "related_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  CONSTRAINT "mail_outbox_status" CHECK ("status" IN ('pending','sent','failed')),
  CONSTRAINT "mail_outbox_locale" CHECK ("locale" IN ('fr','en'))
);
--> statement-breakpoint
CREATE INDEX "mail_outbox_pending" ON "mail_outbox" ("created_at") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX "mail_outbox_related" ON "mail_outbox" ("related_kind", "related_id");
