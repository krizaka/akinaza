import { settingsMigration } from "@krizaka/settings";

/** Migration 0018, generated from the shared block (a test fails when the file and the block drift apart): the overrides and the audit of every change. */
export const SETTINGS_MIGRATION_HEADER = "-- The configuration as data (@krizaka/settings): the overrides, and the audit of every change.\n";
export const SETTINGS_MIGRATION_SQL = SETTINGS_MIGRATION_HEADER + settingsMigration().trimStart();
