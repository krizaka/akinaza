#!/usr/bin/env node
// Puts a storefront template (at the notebook's version) on a shop, by slug, through the product's own `applyTemplate`: the recorders'
// way to give a seeded demo shop the look of a trade (the demo shops get theirs from `seed:demos`; Éric's studio is seeded without one).
//
//   DATABASE_URL=… pnpm --filter @akinaza/web exec tsx scripts/apply-shop-template.mjs <slug> <template-id>
import { CAHIER_VERSION, TEMPLATES, TEMPLATES_V2 } from "@akinaza/core";
import { applyTemplate, createDb, pg, poolConfig } from "@akinaza/db";

const [slug, templateId] = process.argv.slice(2);
if (!slug || !templateId) {
  console.error("usage: apply-shop-template.mjs <slug> <template-id>");
  process.exit(1);
}
const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL, process.env.DATABASE_CA_CERT, 2));
try {
  const { rows } = await pool.query("SELECT id FROM shops WHERE slug = $1", [slug]);
  if (!rows[0]) throw new Error(`no shop with the slug ${slug}`);
  await applyTemplate(createDb(pool), rows[0].id, { templateId, templateVersion: CAHIER_VERSION, keepOrder: false }, [...TEMPLATES, ...TEMPLATES_V2]);
  console.log(`apply-shop-template: ${slug} wears ${templateId}@${CAHIER_VERSION}`);
} catch (error) {
  console.error(`apply-shop-template: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
