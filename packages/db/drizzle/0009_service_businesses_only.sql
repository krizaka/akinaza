-- Akinaza serves service businesses only: restaurants, cafés, bars and bakeries with on-site consumption must use a
-- sales recording system certified MEV-WEB by Revenu Québec, and Akinaza is not one. A shop of the retired kinds
-- (none in production: sign-up is closed) falls to « other » so that the constraint can be tightened.

UPDATE "shops" SET "kind" = 'other' WHERE "kind" IN ('bakery','cafe');
--> statement-breakpoint
ALTER TABLE "shops" DROP CONSTRAINT "shops_kind";
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_kind" CHECK ("kind" IN ('salon','boutique','services','other'));
