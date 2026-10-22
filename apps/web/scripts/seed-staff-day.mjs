#!/usr/bin/env node
// One appointment for a staff member of the demo salon, today, with a fictional client — so a tester can prove the staff day (the
// agenda, check-in, finish) on the deployed site. The staff member is Camille of Cèdre & Ciseaux by default; her row of the shop's team
// is created and linked to her sign-in when it is missing. Idempotent: a re-run finds the same client and the same appointment.
//
//   DATABASE_URL=… DATABASE_CA_CERT=… [QA_STAFF_EMAIL=…] [QA_STAFF_SHOP=cedre-ciseaux] [QA_STAFF_HOUR=16] node scripts/seed-staff-day.mjs
const CLIENT = { fullName: "Léa Fictive (démo)", email: "lea.fictive@akinaza.test" };
const DEFAULT_HOUR = 16;

/** The staff member and the hour to seed, from the environment; refuses what cannot work. */
export function staffDayFromEnv(env) {
  const email = (env.QA_STAFF_EMAIL ?? "camille.staff@akinaza.test").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("QA_STAFF_EMAIL is invalid");
  const hour = env.QA_STAFF_HOUR === undefined ? DEFAULT_HOUR : Number(env.QA_STAFF_HOUR);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("QA_STAFF_HOUR is a whole hour from 0 to 23");
  return { email, hour, shopSlug: env.QA_STAFF_SHOP ?? "cedre-ciseaux", client: CLIENT };
}

async function main() {
  const wanted = staffDayFromEnv(process.env);
  const { default: pg } = await import("pg");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const tls = ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
  url.searchParams.delete("sslmode");
  const client = new pg.Client({ connectionString: url.toString(), ...(tls ? { ssl: { ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n"), rejectUnauthorized: true } } : {}) });
  await client.connect();
  try {
    const [shop] = (await client.query("SELECT id, timezone FROM shops WHERE slug = $1", [wanted.shopSlug])).rows;
    if (!shop) throw new Error(`no shop ${wanted.shopSlug}`);
    const [account] = (await client.query("SELECT id, email FROM accounts WHERE email = $1", [wanted.email])).rows;
    if (!account) throw new Error(`no account ${wanted.email}: run seed-staff first`);
    const [existing] = (await client.query("SELECT id FROM staff WHERE shop_id = $1 AND account_id = $2", [shop.id, account.id])).rows;
    const staffId =
      existing?.id ?? (await client.query("INSERT INTO staff (shop_id, name, account_id) VALUES ($1, $2, $3) RETURNING id", [shop.id, wanted.email.split("@")[0].split(".")[0].replace(/^./, (c) => c.toUpperCase()), account.id])).rows[0].id;
    const [service] = (await client.query("SELECT id, duration_minutes FROM services WHERE shop_id = $1 AND active ORDER BY created_at LIMIT 1", [shop.id])).rows;
    if (!service) throw new Error("the shop has no service");
    const [known] = (await client.query("SELECT id FROM clients WHERE shop_id = $1 AND email = $2", [shop.id, wanted.client.email])).rows;
    const clientId = known?.id ?? (await client.query("INSERT INTO clients (shop_id, full_name, email, language) VALUES ($1, $2, $3, 'fr') RETURNING id", [shop.id, wanted.client.fullName, wanted.client.email])).rows[0].id;
    // Today in the shop's zone at the wanted hour, for the service's length.
    const start = `(date_trunc('day', now() AT TIME ZONE $1) + make_interval(hours => $2)) AT TIME ZONE $1`;
    const [done] = (
      await client.query(`SELECT id FROM appointments WHERE shop_id = $3 AND staff_id = $4 AND client_id = $5 AND lower(during) = ${start}`, [shop.timezone, wanted.hour, shop.id, staffId, clientId])
    ).rows;
    if (!done) {
      await client.query(
        `INSERT INTO appointments (shop_id, staff_id, client_id, service_id, during, status)
         VALUES ($3, $4, $5, $6, tstzrange(${start}, ${start} + make_interval(mins => $7)), 'booked')`,
        [shop.timezone, wanted.hour, shop.id, staffId, clientId, service.id, service.duration_minutes],
      );
    }
    console.log(`seed-staff-day: ${wanted.client.fullName} at ${wanted.hour}:00 with ${wanted.email} (${done ? "already there" : "added"})`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`seed-staff-day: ${error.message}`);
    process.exit(1);
  });
}
