import { webhooksMigration } from "@krizaka/webhooks";

/** Migration 0019, generated from the shared block (a test fails when the file and the block drift apart): endpoints, queued deliveries, inbound events seen. */
export const WEBHOOKS_MIGRATION_HEADER = "-- Webhooks (@krizaka/webhooks): an owner's endpoints, the deliveries queued for them, the inbound events already applied.\n";
export const WEBHOOKS_MIGRATION_SQL = WEBHOOKS_MIGRATION_HEADER + webhooksMigration("accounts").trimStart();
