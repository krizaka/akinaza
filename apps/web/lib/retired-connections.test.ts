import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** krizaka/akinaza#174: the social-sync feature is retired until Google / Meta access exists (#74). */
describe("the social-sync feature is retired", () => {
  it("has no route, helper, domain module, schema or env switch left", () => {
    for (const gone of [
      "apps/web/app/api/walker/connections",
      "apps/web/app/api/walker/sync-proposals",
      "apps/web/app/api/connections.integration.test.ts",
      "apps/web/lib/connectors.ts",
      "apps/web/lib/oauth-state.ts",
      "packages/core/src/social-sync.ts",
      "packages/db/src/social-sync.ts",
    ]) expect(existsSync(join(ROOT, gone)), gone).toBe(false);
    expect(read("packages/db/src/schema.ts")).not.toMatch(/social_connections|sync_proposals|sync_proposal_items|sync_log/);
    expect(read("packages/db/src/index.ts")).not.toContain("social-sync");
    expect(read("packages/core/src/index.ts")).not.toContain("social-sync");
    expect(read("apps/web/lib/env.ts")).not.toContain("APP_SOCIAL_SYNC");
    expect(read("apps/web/lib/http.ts")).not.toContain("AK_SYNC_");
  });

  it("drops the four tables and the immutable-log function in migration 0012", () => {
    const sql = read("packages/db/drizzle/0012_retire_social_sync.sql");
    for (const table of ["sync_proposal_items", "sync_proposals", "sync_log", "social_connections"]) expect(sql).toContain(`DROP TABLE IF EXISTS "${table}"`);
    expect(sql).toContain("DROP FUNCTION IF EXISTS ak_sync_log_immutable");
    expect(read("packages/db/drizzle/meta/_journal.json")).toContain("0012_retire_social_sync");
  });
});
