import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { API_KEYS_MIGRATION_SQL } from "./api-keys";

it("the migration file is exactly what the shared block generates", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0016_api_keys.sql", import.meta.url)), "utf8")).toBe(API_KEYS_MIGRATION_SQL);
});
