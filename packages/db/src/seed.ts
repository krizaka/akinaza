import { localDay } from "@krizaka/intl";
import { persona } from "@krizaka/org";
import { eq } from "drizzle-orm";

import type { Db } from "./client";
import { book, issueInvoice, recordConsent, recordExpense } from "./shop-ops";
import { accounts, clients, services, shopRules, shops, staff } from "./schema";

/**
 * A demo shop for a development database (never a shared or production one): a Montréal hair salon owned by the QA
 * account, two stylists, three services, three clients with their consents, today's appointments, an invoice issued
 * through the real code (GST/QST, ledger) and an expense. Idempotent per account.
 */
export async function seedDemoShop(db: Db, ownerEmail: string, now = new Date()) {
  const [owner] = await db.select().from(accounts).where(eq(accounts.email, ownerEmail.toLowerCase()));
  if (!owner) throw new Error(`no account ${ownerEmail}: run the QA accounts script first`);
  const [existing] = await db.select().from(shops).where(eq(shops.ownerId, owner.id));
  if (existing) return { shopId: existing.id, created: false };
  const [shop] = await db
    .insert(shops)
    .values({ ownerId: owner.id, name: "Salon Laurier", legalName: "Salon Laurier inc.", kind: "salon", registrant: true, gstNumber: "123456789RT0001", qstNumber: "1234567890TQ0001", address: "1234 av. Laurier E., Montréal QC H2J 1G7" })
    .returning();
  // The shop's rules at their defaults, as a shop created by the app has them: without the row its slots cannot be listed.
  await db.insert(shopRules).values({ shopId: shop!.id });
  const [julie, marc] = await db.insert(staff).values([{ shopId: shop!.id, name: "Julie" }, { shopId: shop!.id, name: "Marc" }]).returning();
  const [cut, colour, brushing] = await db
    .insert(services)
    .values([
      { shopId: shop!.id, nameFr: "Coupe", nameEn: "Haircut", durationMinutes: 45, priceCents: 4_500 },
      { shopId: shop!.id, nameFr: "Coloration", nameEn: "Colour", durationMinutes: 90, priceCents: 9_500 },
      { shopId: shop!.id, nameFr: "Mise en plis", nameEn: "Blow-dry", durationMinutes: 30, priceCents: 3_500 },
    ])
    .returning();
  const people = await db
    .insert(clients)
    .values([
      { shopId: shop!.id, fullName: persona("akinaza", "camille").displayName, email: "camille@example.test", language: persona("akinaza", "camille").locale },
      { shopId: shop!.id, fullName: persona("akinaza", "jordan").displayName, email: "jordan@example.test", language: persona("akinaza", "jordan").locale },
      { shopId: shop!.id, fullName: persona("akinaza", "nadia").displayName, phone: "514-555-0142", language: persona("akinaza", "nadia").locale },
    ])
    .returning();
  for (const c of people) {
    await recordConsent(db, c.id, "service", true, "2026-10-15");
    await recordConsent(db, c.id, "reminders", c.email !== null, "2026-10-15");
  }
  // Today, from 9:00 in Montréal (13:00 UTC in daylight time — the shop's zone decides what "today" is).
  const day = localDay(now, "America/Toronto");
  const slot = (h: number, m = 0) => new Date(`${day}T${String(h + 4).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const todays = [
    { staffId: julie!.id, serviceId: cut!.id, clientId: people[0]!.id, startsAt: slot(9, 30) },
    { staffId: marc!.id, serviceId: colour!.id, clientId: people[1]!.id, startsAt: slot(10) },
    { staffId: julie!.id, serviceId: brushing!.id, clientId: people[2]!.id, startsAt: slot(11) },
    { staffId: julie!.id, serviceId: colour!.id, clientId: null, startsAt: slot(14) },
  ];
  for (const a of todays) await book(db, { shopId: shop!.id, ...a });
  await issueInvoice(db, {
    shopId: shop!.id,
    clientId: people[0]!.id,
    language: "fr",
    issuedOn: day,
    lines: [
      { description: "Coupe / Haircut", quantity: 1, unitPriceCents: 4_500, category: "standard" },
      { description: "Coloration / Colour", quantity: 1, unitPriceCents: 9_500, category: "standard" },
    ],
  });
  await recordExpense(db, { shopId: shop!.id, supplier: "Fournisseur Beauté inc.", paidOn: day, subtotalCents: 24_000, gstCents: 1_200, qstCents: 2_394 });
  return { shopId: shop!.id, created: true };
}
