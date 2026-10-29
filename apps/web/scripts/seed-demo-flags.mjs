#!/usr/bin/env node
// The per-person switches of the three demo shops' owners, on a seeded database (dev deployment, local, CI): after `seed:demos`, through the
// documented setting command (`set-setting.mjs --user`), so the audit and the settings service are the real ones. Idempotent.
//
//   pnpm --filter @akinaza/web exec tsx scripts/seed-demo-flags.mjs     (the database is the one `seed:demos` used)
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { demoOwnerFlagArgs } from "@akinaza/db";

const setSetting = fileURLToPath(new URL("./set-setting.mjs", import.meta.url));
for (const args of demoOwnerFlagArgs()) {
  execFileSync(process.execPath, ["--import", "tsx", setSetting, ...args], { stdio: "inherit" });
}
