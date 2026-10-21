-- Fractional quantities for hourly billing (krizaka/akinaza#111): 7.5 hours of development. The quantity of a line is kept in
-- whole hundredths (7.5 -> 750) and the amount is round(quantity x unit price) half away from zero, in integers, so the
-- cent never depends on a float. Existing lines are multiplied by 100 (a type change rewrites the rows: the written-once
-- trigger on invoice_lines is not asked, nothing is edited). The ledger reads amounts, not quantities: it is not touched.

ALTER TABLE "invoice_lines" DROP CONSTRAINT "invoice_lines_amount";
--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "quantity" TYPE integer USING "quantity" * 100;
--> statement-breakpoint
ALTER TABLE "invoice_lines" RENAME COLUMN "quantity" TO "quantity_hundredths";
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_quantity" CHECK ("quantity_hundredths" <> 0);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_amount" CHECK ("amount_cents" = round(("quantity_hundredths"::bigint * "unit_price_cents"::bigint)::numeric / 100) - "discount_cents");
