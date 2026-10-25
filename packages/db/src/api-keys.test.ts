import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { API_KEYS_MIGRATION_SQL } from "./api-keys";

it("the migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0016_api_keys.sql", import.meta.url)), "utf8")).toBe(API_KEYS_MIGRATION_SQL);
});

import { ACCOUNTS_MIGRATION_SQL } from "./account-migration";

/** @krizaka/auth 0.5 adds `password_resets` to its block: Akinaza has had that very table since 0002, so the applied 0017 stays as it is. */
const PASSWORD_RESETS_BLOCK = /CREATE TABLE IF NOT EXISTS password_resets \([\s\S]*?\n\);\n/;

it("the accounts baseline migration file is exactly what the shared block generates, but for the password resets 0002 already made", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0017_accounts_baseline.sql", import.meta.url)), "utf8")).toBe(ACCOUNTS_MIGRATION_SQL.replace(PASSWORD_RESETS_BLOCK, ""));
  const block = ACCOUNTS_MIGRATION_SQL.match(PASSWORD_RESETS_BLOCK)![0];
  const own = readFileSync(fileURLToPath(new URL("../drizzle/0002_password_resets.sql", import.meta.url)), "utf8");
  for (const column of ["account_id", "token_hash", "created_at", "expires_at", "used_at"]) {
    expect(block).toContain(column);
    expect(own).toContain(`"${column}"`);
  }
  expect(own).toMatch(/"token_hash" text NOT NULL UNIQUE/);
});

import { SETTINGS_MIGRATION_SQL } from "./settings-migration";

it("the settings migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0018_settings.sql", import.meta.url)), "utf8")).toBe(SETTINGS_MIGRATION_SQL);
});

import { WEBHOOKS_MIGRATION_SQL } from "./webhooks-migration";

it("the webhooks migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0019_webhooks.sql", import.meta.url)), "utf8")).toBe(WEBHOOKS_MIGRATION_SQL);
});

import { ROLES_MIGRATION_SQL } from "./roles-migration";

it("the shop roles migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0020_shop_roles.sql", import.meta.url)), "utf8")).toBe(ROLES_MIGRATION_SQL);
});
