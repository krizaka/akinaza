import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { API_KEYS_MIGRATION_SQL } from "./api-keys";

it("the migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0016_api_keys.sql", import.meta.url)), "utf8")).toBe(API_KEYS_MIGRATION_SQL);
});

import { ACCOUNTS_MIGRATION_SQL } from "./account-migration";

it("the accounts baseline migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0017_accounts_baseline.sql", import.meta.url)), "utf8")).toBe(ACCOUNTS_MIGRATION_SQL);
});

import { SETTINGS_MIGRATION_SQL } from "./settings-migration";

it("the settings migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0018_settings.sql", import.meta.url)), "utf8")).toBe(SETTINGS_MIGRATION_SQL);
});

import { WEBHOOKS_MIGRATION_SQL } from "./webhooks-migration";

it("the webhooks migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0019_webhooks.sql", import.meta.url)), "utf8")).toBe(WEBHOOKS_MIGRATION_SQL);
});
