-- A shop outlives its owner's account (the ledger and the consents are written once): when the account and its collections go,
-- the shop only forgets its collection (the package's foreign key had no rule).
ALTER TABLE "shops" DROP CONSTRAINT "shops_collection_id_fkey";
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE SET NULL;
