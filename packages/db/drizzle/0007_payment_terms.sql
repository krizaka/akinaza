-- Due date and payment terms on the invoice (krizaka/akinaza#113). For a supply of $500 or more a buyer needs the payment
-- terms to claim its input tax credits (DORS/91-45, art. 3). The shop's default is data (30 days, 0 = due on receipt);
-- an invoice keeps the terms it was issued under and the due date they gave. The ledger is not touched: terms do not
-- change a tax. Invoices issued before this migration, and credit notes, carry no terms (NULL): nothing is invented.

ALTER TABLE "shops" ADD COLUMN "payment_terms_days" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_payment_terms" CHECK ("payment_terms_days" BETWEEN 0 AND 365);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "terms_days" integer;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_on" date;
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_terms" CHECK (("terms_days" IS NULL AND "due_on" IS NULL) OR ("terms_days" IS NOT NULL AND "due_on" IS NOT NULL AND "terms_days" BETWEEN 0 AND 365 AND "due_on" = "issued_on" + "terms_days"));
