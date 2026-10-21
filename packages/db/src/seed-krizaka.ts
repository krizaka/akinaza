import { applyRate, GST, localDay, QST } from "@akinaza/core";
import { addMonths } from "date-fns";
import { eq } from "drizzle-orm";

import type { Db } from "./client";
import { accounts, invoices, shops } from "./schema";
import { addWindow, joinShop, saveService, saveShopPage, shopOfOwner } from "./service-shop";
import { issueInvoice, recordExpense } from "./shop-ops";

/**
 * Krizaka, a software studio in Montréal, as the first client of Akinaza (dogfooding, 2026-10-21): the business of a
 * services company — hours of development, design and consulting, flat-fee workshops and support — with its business
 * clients, its bilingual invoices and its books. EVERYTHING here is demo data and says so: the legal name carries
 * « (démo) », the GST/QST numbers are the documented fake ones, the amounts are plausible and are never Krizaka's real
 * figures, the clients are fictional companies. Through the same operations the product uses; idempotent per owner account.
 */
export const KRIZAKA = {
  shop: { name: "Krizaka (démo)", legalName: "Technologies Krizaka inc. (démo)", address: "1 rue Exemple, Montréal QC H2X 1Y1 (adresse fictive)", slug: "krizaka-demo", ownerName: "Éric", businessType: "professional" as const },
  taglineFr: "Un studio de logiciel à Montréal : développement, design et conseil, facturés à l'heure ou au forfait.",
  taglineEn: "A software studio in Montréal: development, design and consulting, billed by the hour or by the project.",
  profile: {
    area: "Montréal",
    bioFr: "Krizaka est un studio de logiciel de Montréal. Ceci est la démonstration d'Akinaza sur les livres d'un studio de services : données fictives, montants de démonstration, numéros de taxes factices.",
    bioEn: "Krizaka is a software studio in Montréal. This is Akinaza's demonstration on the books of a services studio: fictional data, demo amounts, made-up tax numbers.",
    publicEmail: "bonjour@krizaka-demo.example",
    seatUnitFr: "personnes",
    seatUnitEn: "people",
  },
  /** The fake registration numbers of the demos (never Krizaka's own). */
  gstNumber: "123456789RT0001",
  qstNumber: "1234567890TQ0001",
  invoicePrefix: "KZ",
  services: [
    { nameFr: "Développement logiciel (à l'heure)", nameEn: "Software development (hourly)", durationMinutes: 60, priceCents: 15_000, capacity: 1 },
    { nameFr: "Design (à l'heure)", nameEn: "Design (hourly)", durationMinutes: 60, priceCents: 12_000, capacity: 1 },
    { nameFr: "Conseil et architecture (à l'heure)", nameEn: "Consulting and architecture (hourly)", durationMinutes: 60, priceCents: 18_000, capacity: 1 },
    { nameFr: "Atelier de cadrage (forfait)", nameEn: "Scoping workshop (flat fee)", durationMinutes: 180, priceCents: 60_000, capacity: 1 },
    { nameFr: "Soutien et maintenance (forfait mensuel)", nameEn: "Support and maintenance (monthly flat fee)", durationMinutes: 60, priceCents: 50_000, capacity: 1 },
  ],
  hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "09:00", endsAt: "17:00" })),
  clients: [
    { email: "contact.cafedupark@akinaza.test", name: "Café du Parc inc. (démo)", phone: "514-555-0111", language: "fr" as const },
    { email: "contact.atelierboreal@akinaza.test", name: "Atelier Boréal inc. (démo)", phone: "514-555-0112", language: "fr" as const },
    { email: "contact.nordstudio@akinaza.test", name: "Nord Studio Montréal Ltd. (demo)", phone: "514-555-0113", language: "en" as const },
  ],
};

/** The persona's accounts in the order the seed expects them: Éric (the owner) first, then one contact per client. */
export const KRIZAKA_EMAILS = ["eric.krizaka@akinaza.test", ...KRIZAKA.clients.map((c) => c.email)] as const;

/** Plausible monthly hours (demo amounts), by client and month back: enough variety to make the books worth reading. */
const HOURS: Record<string, [string, number][][]> = {
  "Café du Parc inc. (démo)": [[["dev", 24], ["support", 1]], [["dev", 32], ["support", 1]], [["dev", 18], ["support", 1]]],
  "Atelier Boréal inc. (démo)": [[["design", 20]], [["design", 14], ["workshop", 1]], [["design", 26]]],
  "Nord Studio Montréal Ltd. (demo)": [[["consulting", 8]], [["consulting", 12], ["dev", 10]], [["consulting", 6]]],
};

/** The business's own costs: a month of hosting, tools and insurance, the GST/QST paid giving input tax credits and refunds. */
async function seedBooks(db: Db, shopId: string, clientIds: Record<string, { id: string; language: "fr" | "en" }>, now: Date): Promise<void> {
  if ((await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.shopId, shopId)).limit(1)).length > 0) return;
  const day = (monthsBack: number, d: number) => `${localDay(addMonths(now, -monthsBack), "America/Toronto").slice(0, 8)}${String(d).padStart(2, "0")}`;
  const nameOf: Record<string, string> = { dev: "Software development (hourly)", design: "Design (hourly)", consulting: "Consulting and architecture (hourly)", workshop: "Scoping workshop (flat fee)", support: "Support and maintenance (monthly flat fee)" };
  for (let back = 3; back >= 1; back--) {
    for (const [name, client] of Object.entries(clientIds)) {
      const plan = HOURS[name]![3 - back]!;
      await issueInvoice(db, {
        shopId,
        clientId: client.id,
        language: client.language,
        issuedOn: day(back, 27),
        lines: plan.map(([key, quantity]) => {
          const spec = KRIZAKA.services.find((s) => s.nameEn === nameOf[key]!)!;
          return { description: `${spec.nameFr} / ${spec.nameEn}`, quantity, unitPriceCents: spec.priceCents, category: "standard" as const };
        }),
      });
    }
    const costs: [string, number, number][] = [["Hébergement infonuagique (démo)", 8_500, 12], ["Logiciels et abonnements (démo)", 12_000, 15], ...(back === 2 ? ([["Assurance responsabilité (démo)", 31_000, 5]] as [string, number, number][]) : [])];
    for (const [supplier, subtotalCents, d] of costs) await recordExpense(db, { shopId, supplier, paidOn: day(back, d), subtotalCents, gstCents: applyRate(subtotalCents, GST), qstCents: applyRate(subtotalCents, QST) });
  }
}

/** Seeds the Krizaka demo business for the owner account (created beforehand). Returns whether it was created now. */
export async function seedKrizaka(db: Db, now: Date): Promise<{ shopId: string; created: boolean }> {
  const [owner] = await db.select().from(accounts).where(eq(accounts.email, KRIZAKA_EMAILS[0]));
  if (!owner) throw new Error(`no account ${KRIZAKA_EMAILS[0]}: create the accounts first`);
  const existing = await shopOfOwner(db, owner.id);
  const page = { ...KRIZAKA.shop, taglineFr: KRIZAKA.taglineFr, taglineEn: KRIZAKA.taglineEn, ...KRIZAKA.profile };
  const { shopId } = await saveShopPage(db, owner.id, { ...page, published: existing?.published ?? false });
  const serviceIds: Record<string, string> = {};
  if (!existing) {
    for (const s of KRIZAKA.services) serviceIds[s.nameEn] = await saveService(db, shopId, s);
    for (const w of KRIZAKA.hours) await addWindow(db, shopId, w);
    await saveShopPage(db, owner.id, { ...page, published: true });
  }
  await db.update(shops).set({ registrant: true, gstNumber: KRIZAKA.gstNumber, qstNumber: KRIZAKA.qstNumber, invoicePrefix: KRIZAKA.invoicePrefix }).where(eq(shops.id, shopId));
  const clientIds: Record<string, { id: string; language: "fr" | "en" }> = {};
  for (const c of KRIZAKA.clients) {
    const [acc] = await db.select().from(accounts).where(eq(accounts.email, c.email));
    if (!acc) throw new Error(`no account ${c.email}: create the accounts first`);
    const { clientId } = await joinShop(db, acc.id, acc.email, shopId, { fullName: c.name, phone: c.phone, language: c.language, consentService: true, consentReminders: false });
    clientIds[c.name] = { id: clientId, language: c.language };
  }
  await seedBooks(db, shopId, clientIds, now);
  return { shopId, created: !existing };
}
