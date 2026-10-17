import { localDay, localInstant } from "@akinaza/core";
import { addDays, addMinutes } from "date-fns";
import { eq } from "drizzle-orm";

import type { Db } from "./client";
import { accounts, shops } from "./schema";
import { addDependant, addWindow, addZone, bookVisit, joinShop, listSlots, saveService, saveShopPage, setAccessNotes, shopOfOwner } from "./service-shop";
import { checkIn, checkOut, saveReport } from "./visits";

/**
 * The fictional Saint-Henri dog walker of the demos (Akinaza#52): an adult who is clearly not a real person, five
 * clients with their dogs, a published shop page, and a few walks around today. Everything goes through the same
 * operations the product uses — no row is written around the rules. Idempotent per walker account.
 */
export const SAINT_HENRI = {
  shop: { name: "Pattes de Saint-Henri", legalName: "Pattes de Saint-Henri (démo)", address: "2000 rue Notre-Dame O., Montréal QC H3J 1N4", slug: "pattes-saint-henri", ownerName: "Léa" },
  taglineFr: "Commerce fictif pour la démonstration d'Akinaza — aucune personne réelle. Promenades de quartier à Saint-Henri.",
  taglineEn: "A fictional shop that demonstrates Akinaza — no real person. Neighbourhood dog walks in Saint-Henri.",
  zones: ["Saint-Henri", "Griffintown", "Pointe-Saint-Charles"],
  services: [
    { nameFr: "Promenade solo 30 min", nameEn: "Solo walk 30 min", durationMinutes: 30, priceCents: 2_200, capacity: 1 },
    { nameFr: "Promenade solo 60 min", nameEn: "Solo walk 60 min", durationMinutes: 60, priceCents: 3_500, capacity: 1 },
    { nameFr: "Promenade en groupe 60 min", nameEn: "Group walk 60 min", durationMinutes: 60, priceCents: 2_200, capacity: 5 },
    { nameFr: "Visite chiot 20 min", nameEn: "Puppy visit 20 min", durationMinutes: 20, priceCents: 1_800, capacity: 1 },
  ],
  hours: [
    ...[1, 2, 3, 4, 5].flatMap((weekday) => [
      { weekday, startsAt: "08:00", endsAt: "12:00" },
      { weekday, startsAt: "13:00", endsAt: "17:00" },
    ]),
    { weekday: 6, startsAt: "09:00", endsAt: "12:00" },
  ],
  clients: [
    { email: "camille.tremblay@akinaza.test", name: "Camille Tremblay", phone: "514-555-0101", language: "fr" as const, notes: "Code de la porte 4821, clé de secours sous le pot de lavande.", dogs: [{ name: "Rex", breed: "Labrador", size: "large" as const, temperament: "Joueur, tire un peu en laisse" }] },
    { email: "jordan.lee@akinaza.test", name: "Jordan Lee", phone: "514-555-0102", language: "en" as const, notes: "Buzzer 12, leash on the hook by the door.", dogs: [{ name: "Luna", breed: "Border collie", size: "medium" as const, temperament: "Shy with other dogs at first" }] },
    { email: "nadia.benali@akinaza.test", name: "Nadia Benali", phone: "514-555-0103", language: "fr" as const, notes: null, dogs: [{ name: "Biscuit", breed: "Cavapoo", size: "small" as const, temperament: "Doux" }, { name: "Pixel", breed: "Chihuahua", size: "small" as const, temperament: "Craintif des vélos" }] },
    { email: "etienne.gagnon@akinaza.test", name: "Étienne Gagnon", phone: "514-555-0104", language: "fr" as const, notes: "Cadenas du portail : 0719.", dogs: [{ name: "Érable", breed: "Golden retriever", size: "large" as const, temperament: "Adore l'eau" }] },
    { email: "sofia.rossi@akinaza.test", name: "Sofia Rossi", phone: "514-555-0105", language: "en" as const, notes: null, dogs: [{ name: "Tofu", breed: "Shiba inu", size: "medium" as const, temperament: "Independent, never off leash" }] },
  ],
};

/** The e-mails of the persona's accounts, in the order the seed expects them (the walker first). */
export const SAINT_HENRI_EMAILS = ["lea.beaulieu@akinaza.test", ...SAINT_HENRI.clients.map((c) => c.email)] as const;

export async function seedSaintHenri(db: Db, key: Buffer, now: Date): Promise<{ shopId: string; created: boolean; clientIds: Record<string, string> }> {
  const [owner] = await db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0]));
  if (!owner) throw new Error(`no account ${SAINT_HENRI_EMAILS[0]}: create the accounts first`);
  const existing = await shopOfOwner(db, owner.id);
  if (existing) return { shopId: existing.id, created: false, clientIds: {} };
  const page = { ...SAINT_HENRI.shop, taglineFr: SAINT_HENRI.taglineFr, taglineEn: SAINT_HENRI.taglineEn };
  const { shopId } = await saveShopPage(db, owner.id, { ...page, published: false });
  const zones: Record<string, string> = {};
  for (const name of SAINT_HENRI.zones) zones[name] = await addZone(db, shopId, name);
  const services: Record<string, string> = {};
  for (const s of SAINT_HENRI.services) services[s.nameEn] = await saveService(db, shopId, s);
  for (const w of SAINT_HENRI.hours) await addWindow(db, shopId, w);
  await saveShopPage(db, owner.id, { ...page, published: true });

  const clientIds: Record<string, string> = {};
  const dogIds: Record<string, string> = {};
  for (const c of SAINT_HENRI.clients) {
    const [acc] = await db.select().from(accounts).where(eq(accounts.email, c.email));
    if (!acc) throw new Error(`no account ${c.email}: create the accounts first`);
    const { clientId } = await joinShop(db, acc.id, acc.email, shopId, { fullName: c.name, phone: c.phone, language: c.language, consentService: true, consentReminders: c.language === "fr" });
    clientIds[c.email] = clientId;
    for (const d of c.dogs) dogIds[d.name] = await addDependant(db, clientId, { kind: "dog", name: d.name, profile: { breed: d.breed, size: d.size, temperament: d.temperament } });
    if (c.notes) await setAccessNotes(db, key, clientId, c.notes);
  }

  const group = services["Group walk 60 min"]!;
  const zone = zones["Saint-Henri"]!;
  /** The offered slot of a local day at a wall-clock time (minutes after midnight), asked as of `asOf`. */
  const slotAt = async (day: string, minutes: number, asOf: Date) => {
    const wanted = localInstant(day, minutes, "America/Toronto").getTime();
    return (await listSlots(db, { shopId, serviceId: group, zoneId: zone, now: asOf, fromDay: day, days: 1 })).find((s) => s.startsAt.getTime() === wanted);
  };

  // A walk that already happened (a weekday morning in the last week, with its report), so the clients' space has a past to show.
  for (let back = 1; back <= 7; back++) {
    const asOf = addDays(now, -(back + 2));
    const past = await slotAt(localDay(addDays(now, -back), "America/Toronto"), 9 * 60, asOf);
    if (!past) continue;
    const booked = await bookVisit(db, { clientId: clientIds[SAINT_HENRI.clients[0]!.email]!, serviceId: group, zoneId: zone, dependantIds: [dogIds["Rex"]!], startsAt: past.startsAt, now: asOf });
    await checkIn(db, shopId, booked.appointmentId, past.startsAt);
    await checkOut(db, shopId, booked.appointmentId, addMinutes(past.startsAt, 52));
    await saveReport(db, { shopId, bookingId: booked.bookingIds[0]!, note: "Rex a très bien marché, 52 min autour du canal Lachine. Beaucoup d'énergie, pipi ✓" });
    break;
  }

  // The next group walk in Saint-Henri (14:00) already has two dogs on it: a third joins when the demo books.
  for (let ahead = 0; ahead <= 7; ahead++) {
    const upcoming = await slotAt(localDay(addDays(now, ahead), "America/Toronto"), 14 * 60, now);
    if (!upcoming) continue;
    await bookVisit(db, { clientId: clientIds[SAINT_HENRI.clients[1]!.email]!, serviceId: group, zoneId: zone, dependantIds: [dogIds["Luna"]!], startsAt: upcoming.startsAt, now });
    await bookVisit(db, { clientId: clientIds[SAINT_HENRI.clients[3]!.email]!, serviceId: group, zoneId: zone, dependantIds: [dogIds["Érable"]!], startsAt: upcoming.startsAt, now });
    break;
  }
  return { shopId, created: true, clientIds };
}

export async function shopExists(db: Db, slug: string): Promise<boolean> {
  return (await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, slug))).length > 0;
}
