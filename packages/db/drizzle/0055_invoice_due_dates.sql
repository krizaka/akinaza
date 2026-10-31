-- Every invoice has a due date (krizaka-internal#1912). Terms existed since 0007, but an invoice issued before them kept none, so it was never
-- « overdue » however old: the home said « On track » for invoices unpaid since July. Each such invoice gets the shop's CURRENT terms (the terms it
-- was really issued under are not known) and the day they give; the number of invoices touched is written to the audit log. The ledger is not
-- touched: terms do not change a tax. A credit note has none (it cancels, it is not due). From now on an invoice that is not a credit note
-- cannot be stored without its terms and its due day.
-- Issued invoices are written once (0001); this is the one exception, for the terms only: amounts, lines and ledger are not touched, the trigger is
-- off for this statement alone and back on right after.
ALTER TABLE "invoices" DISABLE TRIGGER "invoices_written_once";
--> statement-breakpoint
WITH fixed AS (
  UPDATE "invoices" i
     SET "terms_days" = s."payment_terms_days",
         "due_on" = i."issued_on" + s."payment_terms_days"
    FROM "shops" s
   WHERE s."id" = i."shop_id" AND i."credit_of" IS NULL AND i."terms_days" IS NULL
  RETURNING i."id"
)
INSERT INTO "audit_log" ("actor_label", "action", "detail")
SELECT 'migration 0055', 'invoices.due_backfilled', jsonb_build_object('invoices', count(*)) FROM fixed HAVING count(*) > 0;
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE TRIGGER "invoices_written_once";
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_due_set" CHECK ("credit_of" IS NOT NULL OR ("terms_days" IS NOT NULL AND "due_on" IS NOT NULL));
