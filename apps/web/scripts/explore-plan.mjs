#!/usr/bin/env node
// The query plan and the timings of Explorer's search on a synthetic set (ADR-006, akinaza#574). It needs a throw-away PostgreSQL given by
// PLAN_PG (a connection string of a server where it may create and drop a database of its own), creates SHOPS shops (default 20000) with a
// worker, hours, rules, two areas and three services each, refreshes the read model once, then prints the p50 and p95 of each filter shape
// over RUNS runs (default 40) and the EXPLAIN (ANALYZE, BUFFERS) of the combined query. Synthetic data only.
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { exploreQuerySchema } from "@akinaza/core";
import { createDb, exploreSearch, exploreStatement, migrate, pg, settleAvailability } from "@akinaza/db";
import { PgDialect } from "drizzle-orm/pg-core";

const server = process.env.PLAN_PG;
if (!server) {throw new Error("PLAN_PG (a PostgreSQL connection string for a throw-away server) is required");}
const SHOPS = Number(process.env.SHOPS ?? 20_000);
const RUNS = Number(process.env.RUNS ?? 40);
const NOW = new Date("2026-10-19T14:00:00Z"); // Monday 10:00 in Montréal
const name = `ak_plan_${crypto.randomBytes(5).toString("hex")}`;
const folder = fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url));

const root = new pg.Client({ connectionString: server });
await root.connect();
await root.query(`CREATE DATABASE ${name}`);
const url = new URL(server);
url.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });
pool.on("error", (e) => console.log("pool:", e.message));
try {
  await migrate(pool, folder);
  const t0 = Date.now();
  const triggers = (state) => ["shops", "shop_zones", "services"].map((t) => pool.query(`ALTER TABLE ${t} ${state} TRIGGER USER`));
  await Promise.all(triggers("DISABLE"));
  const areas = "(ARRAY['Rosemont','Verdun','Outremont','Saint-Henri','Plateau','Griffintown'])[1 + i % 6]";
  await pool.query(`INSERT INTO shops (id, registrant, name, legal_name, kind, address, slug, published, area, tagline_fr, tagline_en, timezone)
    SELECT gen_random_uuid(), false, (ARRAY['Salon','Atelier','Studio','Boutique','Pattes','Cèdre','Encre'])[1 + i % 7] || ' ' || ${areas} || ' ' || i,
      'Demo ' || i, (ARRAY['salon','boutique','services','other'])[1 + i % 4], '1 rue Exemple', 'demo-' || i, true,
      ${areas}, 'Un service près de chez vous', 'A service near you', 'America/Toronto'
    FROM generate_series(1, ${SHOPS}) i`);
  await pool.query("INSERT INTO shop_rules (shop_id) SELECT id FROM shops");
  await pool.query("INSERT INTO staff (shop_id, name) SELECT id, 'Owner' FROM shops");
  await pool.query("INSERT INTO schedules (staff_id, weekday, starts_at, ends_at) SELECT st.id, d, '09:00', (CASE WHEN random() < 0.5 THEN '12:00' ELSE '17:00' END)::time FROM staff st, generate_series(1, 5) d");
  await pool.query("INSERT INTO shop_zones (shop_id, name, position, lat, lng) SELECT id, 'Zone ' || n, n, 45.40 + random() * 0.20, -73.80 + random() * 0.35 FROM shops, generate_series(1, 2) n");
  await pool.query("INSERT INTO services (shop_id, name_fr, name_en, duration_minutes, price_cents) SELECT id, (ARRAY['Coupe','Promenade','Consultation','Tatouage'])[1 + n % 4] || ' ' || n, (ARRAY['Cut','Walk','Consulting','Tattoo'])[1 + n % 4] || ' ' || n, 30 + 30 * n, 2000 FROM shops, generate_series(1, 3) n");
  await Promise.all(triggers("ENABLE"));
  await pool.query("SELECT refresh_shop_search(id) FROM shops");
  await pool.query("ANALYZE");
  console.log(`seeded ${SHOPS} shops in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  const db = createDb(pool);
  const shapes = {
    "no filter (limit 30)": { limit: 30 },
    "text: coupe ros": { q: "coupe ros", limit: 30 },
    "text typo: pates": { q: "pates", limit: 30 },
    "kind + open now": { kinds: ["salon", "services"], open: "now", limit: 30 },
    "open this week": { open: "week", limit: 30 },
    "near 3 km": { near: [-73.58, 45.5], within: 3, limit: 30 },
    "bbox of the viewport": { bbox: [-73.62, 45.47, -73.55, 45.52], limit: 30 },
    "combined: text + open now + near 10 km": { q: "salon", open: "now", near: [-73.58, 45.5], within: 10, limit: 30 },
    "free-today (stored)": { open: "free-today", near: [-73.58, 45.5], within: 3, limit: 30 },
  };
  const pct = (xs, p) => [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(xs.length * p))].toFixed(1);
  const repeat = async (n, fn) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(await fn());
    }
    return out;
  };
  const time = async (fn) => { const s = performance.now(); const out = await fn(); return [performance.now() - s, out]; };
  // The sweep fills the stored availability (what the server's tick does): the whole set once, then a day change.
  const sweep = async (at) => {
    let n = 0;
    const s = performance.now();
    for (let k = await settleAvailability(db, at, 500); k > 0; k = await settleAvailability(db, at, 500)) {
      n += k;
    }
    return `${n} shops in ${((performance.now() - s) / 1000).toFixed(1)} s`;
  };
  console.log("first sweep:", await sweep(NOW));
  if (process.env.SKIP_DAY_CHANGE !== "1") {
    console.log("day-change sweep:", await sweep(new Date(NOW.getTime() + 86_400_000)), "(then back to NOW)");
    await sweep(NOW);
  }
  console.log("\nshape | SQL only p50/p95 ms | page p50/p95 ms (first run is cold: plan and pages not cached) | rows");
  for (const [label, raw] of Object.entries(shapes)) {
    const query = exploreSearchQuery(raw);
    const sqlOnly = await repeat(RUNS, async () => (await time(() => db.execute(exploreStatement(query, NOW).statement)))[0]);
    const timed = await repeat(RUNS, () => time(() => exploreSearch(db, query, NOW)));
    const page = timed.map(([ms]) => ms);
    const rows = timed.at(-1)?.[1].shops.length ?? 0;
    console.log(`${label} | ${pct(sqlOnly, 0.5)} / ${pct(sqlOnly, 0.95)} | ${pct(page, 0.5)} / ${pct(page, 0.95)} | ${rows}`);
  }
  const { statement } = exploreStatement(exploreSearchQuery(shapes[process.env.PLAN_SHAPE ?? "combined: text + open now + near 10 km"]), NOW);
  const { sql: text, params } = new PgDialect().sqlToQuery(statement);
  const plan = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${text}`, params);
  console.log("\nEXPLAIN (ANALYZE, BUFFERS) of the combined query\n" + plan.rows.map((r) => r["QUERY PLAN"]).join("\n"));
} finally {
  await pool.end();
  await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await root.end();
}

function exploreSearchQuery(raw) {
  return exploreQuerySchema.parse(raw);
}
