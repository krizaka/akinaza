/**
 * `pnpm run payments:setup`: sets the processor's catalogue up from the database. The amounts are the price catalogue in force
 * (`price_versions`), the rest (lookup keys, names, tax codes) is `infra/payments/plans.json`. Needs DATABASE_URL and the processor's key
 * (PAYMENTS_STRIPE_SECRET_KEY); extra arguments (--webhook-url, --secret-out…) go to `krizaka-payments-setup`. Nothing secret is printed.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { processorCatalogue, type ProcessorPlans } from "../lib/payments/processor-catalogue";
import { appPrices } from "../lib/price-catalogue";

const plans = JSON.parse(readFileSync(fileURLToPath(new URL("../../../infra/payments/plans.json", import.meta.url)), "utf8")) as ProcessorPlans;
const catalogue = processorCatalogue(plans, await appPrices().catalogue(new Date()));
const dir = mkdtempSync(join(tmpdir(), "akinaza-catalogue-"));
const file = join(dir, "catalogue.json");
try {
  writeFileSync(file, JSON.stringify(catalogue), { mode: 0o600 });
  for (const p of catalogue.plans) {console.log(`${p.lookupKey}: ${p.amount} ${p.currency} / ${p.interval} (from the database)`);}
  const run = spawnSync(fileURLToPath(new URL("../node_modules/.bin/krizaka-payments-setup", import.meta.url)), ["--catalogue", file, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
