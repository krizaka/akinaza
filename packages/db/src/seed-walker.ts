import { localDay, localInstant } from "@akinaza/core";
import { addDays, addMinutes } from "date-fns";
import { and, eq } from "drizzle-orm";

import type { Db } from "./client";
import { accounts, services, shops, shopZones } from "./schema";
import { addDependant, addWindow, addZone, bookVisit, joinShop, listSlots, saveShopMedia, saveShopPage, saveService, setAccessNotes, shopOfOwner } from "./service-shop";
import { checkIn, checkOut, saveReport } from "./visits";

/**
 * The fictional Saint-Henri dog walker of the demos (Akinaza#52): an adult who is clearly not a real person, five
 * clients with their dogs, a published shop page, and a few walks around today. Everything goes through the same
 * operations the product uses — no row is written around the rules. Idempotent per walker account.
 */
export const SAINT_HENRI = {
  shop: { name: "Pattes de Saint-Henri", legalName: "Pattes de Saint-Henri (démo)", address: "2000 rue Notre-Dame O., Montréal QC H3J 1N4", slug: "pattes-saint-henri", ownerName: "Léa" },
  taglineFr: "Des promenades de quartier, avec une photo et un mot après chaque sortie.",
  taglineEn: "Neighbourhood dog walks, with a photo and a note after every outing.",
  /** What the storefront shows beyond the tagline: the locality, the bio (it says the shop is a demo), how to reach the shop. */
  profile: {
    area: "Saint-Henri, Montréal",
    bioFr: "Je m'appelle Léa et je promène les chiens de Saint-Henri, de Griffintown et de la Pointe-Saint-Charles. Après chaque sortie, vous recevez une photo et un mot. Commerce fictif pour la démonstration d'Akinaza — aucune personne réelle.",
    bioEn: "I'm Léa and I walk dogs in Saint-Henri, Griffintown and Pointe-Saint-Charles. After every outing you get a photo and a note. A fictional shop that demonstrates Akinaza — no real person.",
    publicPhone: "514-555-0100",
    publicEmail: "bonjour@pattes-saint-henri.example",
    seatUnitFr: "chiens",
    seatUnitEn: "dogs",
  },
  zones: ["Saint-Henri", "Griffintown", "Pointe-Saint-Charles"],
  /** Where each area is centred, for the map of the storefront. */
  zonePlaces: { "Saint-Henri": { lat: 45.4786, lng: -73.5878 }, Griffintown: { lat: 45.4935, lng: -73.561 }, "Pointe-Saint-Charles": { lat: 45.479, lng: -73.558 } } as Record<string, { lat: number; lng: number }>,
  services: [
    { nameFr: "Promenade solo 30 min", nameEn: "Solo walk 30 min", durationMinutes: 30, priceCents: 2_200, capacity: 1 },
    { nameFr: "Promenade solo 60 min", nameEn: "Solo walk 60 min", durationMinutes: 60, priceCents: 3_500, capacity: 1 },
    { nameFr: "Promenade en groupe 60 min", nameEn: "Group walk 60 min", durationMinutes: 60, priceCents: 2_200, capacity: 5 },
    { nameFr: "Visite chiot 20 min", nameEn: "Puppy visit 20 min", durationMinutes: 20, priceCents: 1_800, capacity: 1 },
  ],
  /** The card of each service on the storefront, by its English name. */
  cards: {
    "Puppy visit 20 min": {
      descriptionFr: "Une courte visite pour les petits qui ne peuvent pas attendre : pipi, jeu et câlins.",
      descriptionEn: "A quick visit for puppies who can't wait: potty break, play and cuddles.",
      includedFr: ["Sortie pipi et jeu", "Eau fraîche", "Un mot après la visite"],
      includedEn: ["Potty break and play", "Fresh water", "A note after the visit"],
    },
    "Solo walk 30 min": {
      descriptionFr: "Un chien, une marcheuse, à son rythme.",
      descriptionEn: "One dog, one walker, at their pace.",
      includedFr: ["Départ et retour à votre porte", "Eau fraîche et serviette", "Une photo et un mot après"],
      includedEn: ["Pick-up and drop-off at your door", "Fresh water and a towel-down", "A photo and a note after"],
    },
    "Solo walk 60 min": {
      descriptionFr: "Une vraie sortie d'une heure pour les chiens qui ont de l'énergie à dépenser.",
      descriptionEn: "A proper one-hour outing for dogs with energy to burn.",
      includedFr: ["Départ et retour à votre porte", "Parc ou bord du canal Lachine", "Une photo et un mot après"],
      includedEn: ["Pick-up and drop-off at your door", "Park or the Lachine canal", "A photo and a note after"],
    },
    "Group walk 60 min": {
      descriptionFr: "De petites meutes de chiens qui s'entendent bien, au parc et le long du canal.",
      descriptionEn: "Small packs of dogs that get along, in the park and along the canal.",
      includedFr: ["Rencontre d'essai avant la première sortie", "Ramassage à votre porte", "Une photo et un mot après"],
      includedEn: ["A meet-and-greet before the first walk", "Pick-up at your door", "A photo and a note after"],
    },
  } as Record<string, { descriptionFr: string; descriptionEn: string; includedFr: string[]; includedEn: string[] }>,
  /** The shop's photos: the cover (an autumn view from Mont-Royal, the neighbourhood's mood) and the gallery (the real recordings of the walker's journey on dev). */
  media: {
    cover: { url: "https://krizaka-assets.b-cdn.net/site/products/orazaka/gallery/mtl-mont-royal.4f8387c925.webp", altFr: "Montréal en automne, vue depuis le mont Royal.", altEn: "Montréal in autumn, seen from Mont Royal." },
    gallery: [
      { url: "https://krizaka-assets.b-cdn.net/site/products/orazaka/gallery/mtl-ruelle.021f8cb018.webp", altFr: "Une ruelle de quartier sous la pluie.", altEn: "A neighbourhood alley in the rain.", captionFr: "Le quartier", captionEn: "The neighbourhood", wide: true },
      {
        url: "https://krizaka-assets.b-cdn.net/site/products/akinaza/tour/phone-report.af3aa7b92b.jpg",
        webmUrl: "https://krizaka-assets.b-cdn.net/site/products/akinaza/tour/report.47b4fef558.webm",
        mp4Url: "https://krizaka-assets.b-cdn.net/site/products/akinaza/tour/report.b1f25d285f.mp4",
        altFr: "Léa écrit le rapport d'une promenade : une photo et un mot.",
        altEn: "Léa writes the report of a walk: a photo and a note.",
        captionFr: "Le rapport après la sortie",
        captionEn: "The report after the walk",
      },
      { url: "https://krizaka-assets.b-cdn.net/site/products/akinaza/tour/phone-client.c5b88410f9.jpg", altFr: "Le rapport reçu par la cliente, avec la photo de son chien.", altEn: "The report as the client receives it, with her dog's photo.", captionFr: "Ce que vous recevez", captionEn: "What you receive" },
    ],
  },
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

/** The storefront's words, places and photos of the persona: idempotent, so a shop seeded before them gains them on the next run. */
export async function enrichSaintHenri(db: Db, ownerId: string, shopId: string): Promise<void> {
  const shop = (await db.select().from(shops).where(eq(shops.id, shopId)))[0]!;
  const owner = { name: shop.name, legalName: shop.legalName, address: shop.address, slug: shop.slug ?? SAINT_HENRI.shop.slug, ownerName: SAINT_HENRI.shop.ownerName, published: shop.published };
  await saveShopPage(db, ownerId, { ...owner, taglineFr: SAINT_HENRI.taglineFr, taglineEn: SAINT_HENRI.taglineEn, ...SAINT_HENRI.profile });
  for (const [name, place] of Object.entries(SAINT_HENRI.zonePlaces)) await db.update(shopZones).set(place).where(and(eq(shopZones.shopId, shopId), eq(shopZones.name, name)));
  for (const [nameEn, card] of Object.entries(SAINT_HENRI.cards)) await db.update(services).set(card).where(and(eq(services.shopId, shopId), eq(services.nameEn, nameEn)));
  await saveShopMedia(db, shopId, SAINT_HENRI.media);
}

export async function seedSaintHenri(db: Db, key: Buffer, now: Date): Promise<{ shopId: string; created: boolean; clientIds: Record<string, string> }> {
  const [owner] = await db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0]));
  if (!owner) throw new Error(`no account ${SAINT_HENRI_EMAILS[0]}: create the accounts first`);
  const existing = await shopOfOwner(db, owner.id);
  if (existing) {
    await enrichSaintHenri(db, owner.id, existing.id);
    return { shopId: existing.id, created: false, clientIds: {} };
  }
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
  await enrichSaintHenri(db, owner.id, shopId);
  return { shopId, created: true, clientIds };
}

export async function shopExists(db: Db, slug: string): Promise<boolean> {
  return (await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, slug))).length > 0;
}
