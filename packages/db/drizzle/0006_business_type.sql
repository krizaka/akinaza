-- The kind of business sets the vocabulary of a shop's screens (krizaka/akinaza#117): « walk » and « dog » for pet care,
-- « appointment » and « client » for a studio, a consultant, a repairer. A shop that already has dependants (dogs) is a
-- pet-care shop and keeps its words; every other shop starts professional, and its owner can change it on the shop page.

ALTER TABLE "shops" ADD COLUMN "business_type" text DEFAULT 'professional' NOT NULL;
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_business_type" CHECK ("business_type" IN ('professional','pets'));
--> statement-breakpoint
UPDATE "shops" SET "business_type" = 'pets' WHERE "kind" = 'services' AND EXISTS (SELECT 1 FROM "dependants" d WHERE d."shop_id" = "shops"."id" AND d."kind" IN ('dog','cat'));
