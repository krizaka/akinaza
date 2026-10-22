import { accountsMigration } from "@krizaka/auth";

/** Migration 0017, generated from the shared block (a test fails when the file and the block drift apart): the display name, theme, avatar seed, verified-address flag and the e-mail changes. Existing members' addresses are verified (sign-up is by invitation). */
export const ACCOUNTS_MIGRATION_HEADER = "-- The account baseline (@krizaka/auth): name, theme, avatar seed, verified e-mail, e-mail changes by link.\n";
export const ACCOUNTS_MIGRATION_SQL = ACCOUNTS_MIGRATION_HEADER + accountsMigration({ backfillVerified: true }).trimStart();
