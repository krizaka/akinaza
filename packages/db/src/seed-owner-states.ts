import { localDay } from "@akinaza/core";
import { eq } from "drizzle-orm";

import type { Db } from "./client";
import { accounts } from "./schema";
import { addWindow, joinShop, saveService, saveShopPage, shopOfOwner } from "./service-shop";
import { issueInvoice, recordExpense } from "./shop-ops";

/**
 * The two states of an owner's space that the cast's busy shops never show (akinaza#405): a shop with NOTHING in it
 * (every list is its empty state) and a shop with exactly ONE item per list (a single row, a single card). The page audit
 * crawls the owner's frame as each of them, so an empty state or a lone row that overflows, hides its action or breaks the
 * layout fails CI like any other page. Demo data like the rest: fictional people, « (démo) » in the legal names, never a
 * café, restaurant, bar or bakery. Through the product's own operations; idempotent per owner account.
 */
export const OWNER_STATES = {
  empty: {
    email: "ines.debut@akinaza.test",
    shop: { name: "Atelier du Début (démo)", legalName: "Atelier du Début (démo)", address: "3 rue Exemple, Montréal QC H2X 1Y3 (adresse fictive)", slug: "atelier-du-debut", ownerName: "Inès", businessType: "professional" as const },
  },
  one: {
    email: "yan.seul@akinaza.test",
    shop: { name: "Studio Unique (démo)", legalName: "Studio Unique inc. (démo)", address: "4 rue Exemple, Montréal QC H2X 1Y4 (adresse fictive)", slug: "studio-unique", ownerName: "Yan", businessType: "professional" as const },
    service: { nameFr: "Séance de conseil (à l'heure)", nameEn: "Consulting session (hourly)", durationMinutes: 60, priceCents: 9_000, capacity: 1 },
    window: { weekday: 3, startsAt: "10:00", endsAt: "14:00" },
    client: { email: "contact.uniqueclient@akinaza.test", name: "Atelier Seul inc. (démo)", phone: "514-555-0121", language: "fr" as const },
  },
};

/** The accounts of the two owners and of the lone client, in the order the seed expects them. */
export const OWNER_STATE_EMAILS = [OWNER_STATES.empty.email, OWNER_STATES.one.email, OWNER_STATES.one.client.email] as const;

const ownerOf = async (db: Db, email: string) => {
  const [owner] = await db.select().from(accounts).where(eq(accounts.email, email));
  if (!owner) throw new Error(`no account ${email}: create the accounts first`);
  return owner;
};

/** Seeds both states: the empty owner's shop (nothing in it) and the one-item owner's shop (one service, one window, one client, one invoice, one expense). */
export async function seedOwnerStates(db: Db, now: Date): Promise<{ emptyShopId: string; oneShopId: string }> {
  const { empty, one } = OWNER_STATES;
  const emptyOwner = await ownerOf(db, empty.email);
  const { shopId: emptyShopId } = await saveShopPage(db, emptyOwner.id, { ...empty.shop, published: false });

  const owner = await ownerOf(db, one.email);
  const existing = await shopOfOwner(db, owner.id);
  const { shopId: oneShopId } = await saveShopPage(db, owner.id, { ...one.shop, published: existing?.published ?? false });
  if (existing) return { emptyShopId, oneShopId };
  await saveService(db, oneShopId, one.service);
  await addWindow(db, oneShopId, one.window);
  await saveShopPage(db, owner.id, { ...one.shop, published: true });
  const account = await ownerOf(db, one.client.email);
  const { clientId } = await joinShop(db, account.id, account.email, oneShopId, { fullName: one.client.name, phone: one.client.phone, language: one.client.language, consentService: true, consentReminders: false });
  const today = localDay(now, "America/Toronto");
  await issueInvoice(db, { shopId: oneShopId, clientId, language: one.client.language, issuedOn: today, lines: [{ description: "Séance de conseil", quantity: 1, unitPriceCents: 9_000, category: "standard" }] });
  await recordExpense(db, { shopId: oneShopId, supplier: "Papeterie Exemple (démo)", paidOn: today, subtotalCents: 2_000, gstCents: 100, qstCents: 199 });
  return { emptyShopId, oneShopId };
}
