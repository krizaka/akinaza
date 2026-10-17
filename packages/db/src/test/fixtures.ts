import type { Db } from "../client";
import { accounts, clients, services, shops, staff } from "../schema";
import { addDependant, addWindow, addZone, joinShop, saveService, saveShopPage } from "../service-shop";

/** A Montréal hair salon, registered for the taxes, with two stylists, two services and a client. */
export async function salon(db: Db, opts: { registrant?: boolean } = {}) {
  const registrant = opts.registrant ?? true;
  const [shop] = await db
    .insert(shops)
    .values({ name: "Salon Laurier", legalName: "Salon Laurier inc.", kind: "salon", registrant, gstNumber: registrant ? "123456789RT0001" : null, qstNumber: registrant ? "1234567890TQ0001" : null, address: "1234 av. Laurier E., Montréal QC" })
    .returning();
  const [julie, marc] = await db.insert(staff).values([{ shopId: shop!.id, name: "Julie" }, { shopId: shop!.id, name: "Marc" }]).returning();
  const [cut, colour] = await db
    .insert(services)
    .values([
      { shopId: shop!.id, nameFr: "Coupe", nameEn: "Haircut", durationMinutes: 45, priceCents: 4_500 },
      { shopId: shop!.id, nameFr: "Coloration", nameEn: "Colour", durationMinutes: 90, priceCents: 9_500 },
    ])
    .returning();
  const [client] = await db.insert(clients).values({ shopId: shop!.id, fullName: "Camille Tremblay", email: "camille@example.test", phone: "514-555-0199", language: "fr" }).returning();
  return { shop: shop!, staff: { julie: julie!, marc: marc! }, services: { cut: cut!, colour: colour! }, client: client! };
}

/** A sign-in account (the table's own e-mail rule: lowercase). */
export async function account(db: Db, email: string) {
  const [row] = await db.insert(accounts).values({ email: email.toLowerCase(), passwordHash: "x" }).returning();
  return row!;
}

/** The instant the service-shop tests treat as "now": Monday 19 October 2026, 08:00 in Montréal. */
export const NOW = new Date("2026-10-19T12:00:00Z");

/**
 * A dog walker's published shop (Saint-Henri): three zones, a 60-minute solo walk and a group walk of three dogs,
 * Monday–Friday 09:00–12:00, and two clients who each joined with a dog.
 */
export async function walkerShop(db: Db, tag = "a") {
  const owner = await account(db, `walker-${tag}@example.test`);
  const { shopId } = await saveShopPage(db, owner.id, { name: "Pattes de Saint-Henri", legalName: "Pattes de Saint-Henri", address: "2000 rue Notre-Dame O., Montréal QC", slug: `pattes-${tag}`, ownerName: "Mathilde", published: false });
  const solo = await saveService(db, shopId, { nameFr: "Promenade solo 60 min", nameEn: "Solo walk 60 min", durationMinutes: 60, priceCents: 3_000, capacity: 1 });
  const group = await saveService(db, shopId, { nameFr: "Promenade en groupe", nameEn: "Group walk", durationMinutes: 60, priceCents: 2_000, capacity: 3 });
  const stHenri = await addZone(db, shopId, "Saint-Henri");
  const griffintown = await addZone(db, shopId, "Griffintown");
  for (const weekday of [1, 2, 3, 4, 5]) await addWindow(db, shopId, { weekday, startsAt: "09:00", endsAt: "12:00" });
  await saveShopPage(db, owner.id, { name: "Pattes de Saint-Henri", legalName: "Pattes de Saint-Henri", address: "2000 rue Notre-Dame O., Montréal QC", slug: `pattes-${tag}`, ownerName: "Mathilde", published: true });
  const joined = async (email: string, name: string, dog: string) => {
    const acc = await account(db, email);
    const { clientId } = await joinShop(db, acc.id, acc.email, shopId, { fullName: name, phone: "514-555-0100", language: "fr", consentService: true, consentReminders: true });
    const dogId = await addDependant(db, clientId, { kind: "dog", name: dog, profile: { breed: "Labrador", size: "large" } });
    return { account: acc, clientId, dogId };
  };
  const camille = await joined(`camille-${tag}@example.test`, "Camille Tremblay", "Rex");
  const jordan = await joined(`jordan-${tag}@example.test`, "Jordan Lee", "Luna");
  return { owner, shopId, solo, group, zones: { stHenri, griffintown }, camille, jordan };
}
