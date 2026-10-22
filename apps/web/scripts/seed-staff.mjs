#!/usr/bin/env node
// A team member of a shop for the testers (#180): an account with a role in a shop — by default Camille, « staff » of the demo salon
// Cèdre & Ciseaux. Sign-up is closed: this is how a tester gets in. The password comes from the environment and is never printed
// (the maintainer keeps it with the other tester values). Idempotent: a re-run sets the password and the role again.
//
//   DATABASE_URL=… DATABASE_CA_CERT=… QA_STAFF_EMAIL=… QA_STAFF_PASSWORD=… [QA_STAFF_SHOP=cedre-ciseaux] [QA_STAFF_ROLE=staff] \
//     node scripts/seed-staff.mjs
import { hashPassword } from "./qa-accounts.mjs";

const ROLES = ["owner", "manager", "staff"];

/** The member to seed, from the environment; refuses what cannot work (a bad e-mail, a short password, an unknown role). */
export function staffFromEnv(env) {
  const email = (env.QA_STAFF_EMAIL ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("QA_STAFF_EMAIL is missing or invalid");
  if (!env.QA_STAFF_PASSWORD || env.QA_STAFF_PASSWORD.length < 12) throw new Error("QA_STAFF_PASSWORD is missing or shorter than 12 characters");
  const role = env.QA_STAFF_ROLE ?? "staff";
  if (!ROLES.includes(role)) throw new Error(`QA_STAFF_ROLE is one of ${ROLES.join(", ")}`);
  return { email, password: env.QA_STAFF_PASSWORD, role, shopSlug: env.QA_STAFF_SHOP ?? "cedre-ciseaux" };
}

async function main() {
  const member = staffFromEnv(process.env);
  const { default: pg } = await import("pg");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const tls = ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
  url.searchParams.delete("sslmode");
  const client = new pg.Client({ connectionString: url.toString(), ...(tls ? { ssl: { ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n"), rejectUnauthorized: true } } : {}) });
  await client.connect();
  try {
    const [shop] = (await client.query("SELECT id FROM shops WHERE slug = $1", [member.shopSlug])).rows;
    if (!shop) throw new Error(`no shop ${member.shopSlug}`);
    const [account] = (
      await client.query(
        `INSERT INTO accounts (email, role, password_hash, email_verified_at) VALUES ($1, 'USER', $2, now())
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE' RETURNING id`,
        [member.email, await hashPassword(member.password)],
      )
    ).rows;
    await client.query(
      `INSERT INTO memberships (scope_id, account_id, role, created_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (scope_id, account_id) DO UPDATE SET role = EXCLUDED.role`,
      [shop.id, account.id, member.role],
    );
    console.log(`seed-staff: ${member.email} is ${member.role} of ${member.shopSlug} (password from the environment, not printed)`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`seed-staff: ${error.message}`);
    process.exit(1);
  });
}
