-- Social and listings sync is retired (krizaka/akinaza#174): nothing reads or writes these tables any more.
DROP TABLE IF EXISTS "sync_proposal_items";
--> statement-breakpoint
DROP TABLE IF EXISTS "sync_proposals";
--> statement-breakpoint
DROP TABLE IF EXISTS "sync_log";
--> statement-breakpoint
DROP FUNCTION IF EXISTS ak_sync_log_immutable();
--> statement-breakpoint
DROP TABLE IF EXISTS "social_connections";
