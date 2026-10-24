import type { ShopRules, ShopType } from "@akinaza/core";
import { and, eq } from "drizzle-orm";

import type { Db } from "./client";
import { accounts, services as servicesTable, shops, staff as staffTable } from "./schema";
import { saveShopPageConfig, shopPageConfigOf } from "./shop-page";
import { addStaff, addWindow, saveRules, type ServiceInput, saveService, saveShopMedia, saveShopPage, shopOfOwner } from "./service-shop";

/**
 * The fictional demo shops (krizaka/akinaza#144), each as DATA: a hair salon in Saint-Henri, a tattoo and photo studio in the
 * Mile End, an independent consultant. Names, people and addresses are invented — no real business, no real person — and each
 * says so in its bio. They are seeded through the product's own operations (no row is written around the rules) and show only
 * what Akinaza really runs: service durations and prices, several people with their own hours, the cancellation rule. No
 * deposit, portfolio of an artist, package or multi-session booking appears: they are not built.
 */
export interface DemoShop {
  ownerEmail: string;
  shop: { name: string; legalName: string; address: string; slug: string; ownerName: string };
  taglineFr: string;
  taglineEn: string;
  profile: { area: string; bioFr: string; bioEn: string; publicPhone: string; publicEmail: string };
  /** Who works here: the owner first (the shop's first person), then the others, each with their own weekly hours. */
  team: { name: string; hours: { weekday: number; startsAt: string; endsAt: string }[] }[];
  services: (ServiceInput & { descriptionFr: string; descriptionEn: string; includedFr: string[]; includedEn: string[] })[];
  rules: Partial<ShopRules>;
  /** The trade, which picks the default images the page shows where the shop has none (#267). */
  shopType: ShopType;
  cover?: { url: string; altFr: string; altEn: string };
}

const days = (weekdays: number[], startsAt: string, endsAt: string) => weekdays.map((weekday) => ({ weekday, startsAt, endsAt }));

export const DEMO_SHOPS: DemoShop[] = [
  {
    ownerEmail: "maelle.cedre@akinaza.test",
    shop: { name: "Salon Cèdre & Ciseaux", legalName: "Salon Cèdre & Ciseaux (démo)", address: "4100 rue Notre-Dame O., Montréal QC H4C 1R8", slug: "cedre-ciseaux", ownerName: "Maëlle" },
    taglineFr: "Un salon de quartier à Saint-Henri : coupe, couleur et barbe, avec la personne de votre choix.",
    taglineEn: "A neighbourhood salon in Saint-Henri: cuts, colour and beard care, with the person of your choice.",
    profile: {
      area: "Saint-Henri, Montréal",
      bioFr: "Trois coiffeurs, un salon lumineux sur Notre-Dame Ouest. Vous choisissez la personne, ou « n'importe qui » pour la première heure libre. Commerce fictif pour la démonstration d'Akinaza — aucune personne réelle.",
      bioEn: "Three stylists, one bright salon on Notre-Dame West. Choose the person, or « anyone » for the first free time. A fictional shop that demonstrates Akinaza — no real person.",
      publicPhone: "514-555-0110",
      publicEmail: "bonjour@cedre-ciseaux.example",
    },
    team: [
      { name: "Maëlle", hours: days([2, 3, 4, 5], "09:00", "17:00") },
      { name: "Karim", hours: [...days([3, 4, 5], "11:00", "19:00"), ...days([6], "09:00", "16:00")] },
      { name: "Jade", hours: [...days([2, 3], "12:00", "20:00"), ...days([6], "09:00", "16:00")] },
    ],
    services: [
      { nameFr: "Coupe courte", nameEn: "Short cut", durationMinutes: 30, priceCents: 4_500, capacity: 1, descriptionFr: "Coupe aux ciseaux ou à la tondeuse, finition au rasoir.", descriptionEn: "Scissor or clipper cut, razor finish.", includedFr: ["Consultation", "Lavage", "Coiffage"], includedEn: ["Consultation", "Wash", "Styling"] },
      { nameFr: "Coupe et brushing", nameEn: "Cut and blow-dry", durationMinutes: 60, priceCents: 7_500, capacity: 1, descriptionFr: "Une coupe sur mesure et un brushing qui tient.", descriptionEn: "A tailored cut and a blow-dry that lasts.", includedFr: ["Consultation", "Lavage", "Coupe", "Brushing"], includedEn: ["Consultation", "Wash", "Cut", "Blow-dry"] },
      { nameFr: "Barbe", nameEn: "Beard", durationMinutes: 20, priceCents: 2_500, capacity: 1, descriptionFr: "Taille et contours, serviette chaude.", descriptionEn: "Trim and edges, hot towel.", includedFr: ["Taille", "Contours", "Serviette chaude"], includedEn: ["Trim", "Edges", "Hot towel"] },
      { nameFr: "Couleur complète", nameEn: "Full colour", durationMinutes: 150, priceCents: 16_000, capacity: 1, priceVaries: true, descriptionFr: "Une longue séance : le prix dépend de la longueur et de la densité, confirmé à la consultation.", descriptionEn: "A long session: the price depends on length and density, confirmed at the consultation.", includedFr: ["Consultation couleur", "Application", "Soin", "Brushing"], includedEn: ["Colour consultation", "Application", "Treatment", "Blow-dry"] },
      { nameFr: "Balayage", nameEn: "Balayage", durationMinutes: 180, priceCents: 22_000, capacity: 1, priceVaries: true, descriptionFr: "Éclaircissement progressif, pour un résultat naturel.", descriptionEn: "Gradual lightening for a natural result.", includedFr: ["Consultation couleur", "Balayage", "Soin", "Coiffage"], includedEn: ["Colour consultation", "Balayage", "Treatment", "Styling"] },
    ],
    shopType: "salon",
    rules: { cancellationHours: 24, bookingHorizonDays: 60, slotStepMinutes: 30, minNoticeMinutes: 120 },
  },
  {
    ownerEmail: "ines.encrevive@akinaza.test",
    shop: { name: "Encre Vive Studio", legalName: "Encre Vive Studio (démo)", address: "5300 boul. Saint-Laurent, Montréal QC H2T 1S1", slug: "encre-vive", ownerName: "Inès" },
    taglineFr: "Tatouage et photo dans le Mile End : on se rencontre d'abord, on dessine ensuite.",
    taglineEn: "Tattoo and photo in the Mile End: we meet first, we draw after.",
    profile: {
      area: "Mile End, Montréal",
      bioFr: "Deux tatoueurs et une photographe dans un studio du Mile End. Commencez par une consultation gratuite de 20 minutes. Commerce fictif pour la démonstration d'Akinaza — aucune personne réelle.",
      bioEn: "Two tattoo artists and a photographer in a Mile End studio. Start with a free 20-minute consultation. A fictional shop that demonstrates Akinaza — no real person.",
      publicPhone: "514-555-0120",
      publicEmail: "bonjour@encre-vive.example",
    },
    team: [
      { name: "Inès", hours: days([2, 3, 4, 5, 6], "11:00", "19:00") },
      { name: "Théo", hours: days([3, 4, 5, 6], "12:00", "20:00") },
      { name: "Anouk", hours: days([2, 4, 6], "10:00", "16:00") },
    ],
    services: [
      { nameFr: "Consultation gratuite", nameEn: "Free consultation", durationMinutes: 20, priceCents: 0, capacity: 1, descriptionFr: "On parle de votre idée, de l'emplacement et du temps nécessaire. Aucun engagement.", descriptionEn: "We talk about your idea, the placement and the time it takes. No commitment.", includedFr: ["Écoute de votre idée", "Estimation de la durée"], includedEn: ["Listening to your idea", "A time estimate"] },
      { nameFr: "Petit tatouage (2 h)", nameEn: "Small tattoo (2 h)", durationMinutes: 120, priceCents: 24_000, capacity: 1, priceVaries: true, descriptionFr: "Un motif simple et petit, après la consultation. Le prix final est confirmé au dessin.", descriptionEn: "A simple, small design, after the consultation. The final price is confirmed at the drawing.", includedFr: ["Dessin", "Tatouage", "Soins après"], includedEn: ["Drawing", "Tattoo", "Aftercare"] },
      { nameFr: "Séance de tatouage (4 h)", nameEn: "Tattoo session (4 h)", durationMinutes: 240, priceCents: 48_000, capacity: 1, priceVaries: true, descriptionFr: "Une longue séance pour un motif plus grand. Le prix final est confirmé au dessin.", descriptionEn: "A long session for a larger design. The final price is confirmed at the drawing.", includedFr: ["Dessin", "Tatouage", "Soins après"], includedEn: ["Drawing", "Tattoo", "Aftercare"] },
      { nameFr: "Séance photo portrait (60 min)", nameEn: "Portrait photo session (60 min)", durationMinutes: 60, priceCents: 18_000, capacity: 1, descriptionFr: "Un portrait en studio, lumière naturelle et artificielle.", descriptionEn: "A studio portrait, natural and studio light.", includedFr: ["Séance en studio", "10 photos retouchées", "Galerie en ligne"], includedEn: ["Studio session", "10 retouched photos", "Online gallery"] },
    ],
    shopType: "workshop",
    rules: { cancellationHours: 48, bookingHorizonDays: 90, slotStepMinutes: 30, minNoticeMinutes: 1_440 },
  },
  {
    ownerEmail: "camille.ferland@akinaza.test",
    shop: { name: "Ferland Conseil", legalName: "Ferland Conseil (démo)", address: "6800 rue Clark, Montréal QC H2S 3G7", slug: "ferland-conseil", ownerName: "Camille" },
    taglineFr: "Conseil indépendant en stratégie numérique : un appel pour se connaître, puis des séances de travail.",
    taglineEn: "Independent digital-strategy consulting: a call to get to know each other, then working sessions.",
    profile: {
      area: "Mile End, Montréal",
      bioFr: "Une consultante qui travaille à son compte. Chaque séance est facturée au cent près, avec la TPS et la TVQ détaillées. Commerce fictif pour la démonstration d'Akinaza — aucune personne réelle.",
      bioEn: "A self-employed consultant. Every session is invoiced to the cent, with the GST and QST itemised. A fictional shop that demonstrates Akinaza — no real person.",
      publicPhone: "514-555-0130",
      publicEmail: "bonjour@ferland-conseil.example",
    },
    team: [{ name: "Camille", hours: days([1, 2, 3, 4], "09:00", "17:00") }],
    services: [
      { nameFr: "Appel découverte (20 min)", nameEn: "Discovery call (20 min)", durationMinutes: 20, priceCents: 0, capacity: 1, descriptionFr: "Vingt minutes pour comprendre votre besoin. Sans frais.", descriptionEn: "Twenty minutes to understand your need. No charge.", includedFr: ["Écoute du besoin", "Pistes de travail"], includedEn: ["Listening to the need", "Directions to explore"] },
      { nameFr: "Séance de travail (1 h)", nameEn: "Working session (1 h)", durationMinutes: 60, priceCents: 15_000, capacity: 1, descriptionFr: "Une heure de travail ensemble, avec un compte rendu écrit.", descriptionEn: "One hour of work together, with a written summary.", includedFr: ["Séance en visio ou en personne", "Compte rendu écrit"], includedEn: ["Video or in-person session", "Written summary"] },
      { nameFr: "Bloc de 3 heures", nameEn: "3-hour block", durationMinutes: 180, priceCents: 40_000, capacity: 1, descriptionFr: "Un bloc d'un seul tenant pour un atelier ou un plan d'action.", descriptionEn: "One uninterrupted block for a workshop or an action plan.", includedFr: ["Atelier ou plan d'action", "Compte rendu écrit"], includedEn: ["Workshop or action plan", "Written summary"] },
    ],
    shopType: "consulting",
    rules: { cancellationHours: 24, bookingHorizonDays: 60, slotStepMinutes: 30, minNoticeMinutes: 1_440 },
  },
];

async function ensureOwner(db: Db, email: string): Promise<string> {
  const [found] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email));
  if (found) return found.id;
  const [row] = await db.insert(accounts).values({ email }).returning({ id: accounts.id });
  return row!.id;
}

/** The demo's trade, once: a shop that already chose one keeps it. */
async function keepType(db: Db, shopId: string, shopType: ShopType): Promise<void> {
  const config = await shopPageConfigOf(db, shopId);
  if (!config.shopType) await saveShopPageConfig(db, shopId, { ...config, shopType });
}

/** Seeds (or refreshes) one demo shop through the product's operations. Idempotent per owner: a second run changes nothing it already holds. */
export async function seedDemo(db: Db, demo: DemoShop): Promise<{ shopId: string; created: boolean }> {
  const ownerId = await ensureOwner(db, demo.ownerEmail);
  const page = { ...demo.shop, businessType: "professional" as const, taglineFr: demo.taglineFr, taglineEn: demo.taglineEn, ...demo.profile };
  const existing = await shopOfOwner(db, ownerId);
  if (existing) {
    await keepType(db, existing.id, demo.shopType);
    return { shopId: existing.id, created: false };
  }
  const { shopId } = await saveShopPage(db, ownerId, { ...page, published: false });
  const [owner, ...others] = demo.team;
  for (const w of owner!.hours) await addWindow(db, shopId, w);
  for (const person of others) {
    const id = await addStaff(db, shopId, person.name);
    for (const w of person.hours) await addWindow(db, shopId, w, id);
  }
  for (const s of demo.services) await saveService(db, shopId, s);
  // Registered for the GST and the QST (fictional numbers), so a price is shown before taxes and the tax is exact.
  await db.update(shops).set({ registrant: true, gstNumber: "123456789RT0001", qstNumber: "1234567890TQ0001" }).where(eq(shops.id, shopId));
  const [current] = await db.select().from(shops).where(eq(shops.id, shopId));
  await saveRules(db, shopId, { cancellationHours: 24, bookingHorizonDays: 60, slotStepMinutes: 30, minNoticeMinutes: 120, reportLinkDays: 30, paymentTermsDays: current!.paymentTermsDays, ...demo.rules });
  if (demo.cover) await saveShopMedia(db, shopId, { cover: { ...demo.cover } });
  await saveShopPage(db, ownerId, { ...page, published: true });
  await keepType(db, shopId, demo.shopType);
  return { shopId, created: true };
}

export async function seedDemoShops(db: Db): Promise<{ slug: string; shopId: string; created: boolean }[]> {
  const out = [];
  for (const demo of DEMO_SHOPS) out.push({ slug: demo.shop.slug, ...(await seedDemo(db, demo)) });
  return out;
}

/** How many people and services a demo shop holds (for the proof and the tests). */
export async function demoCounts(db: Db, shopId: string): Promise<{ team: number; services: number }> {
  const [team, services] = await Promise.all([db.select().from(staffTable).where(and(eq(staffTable.shopId, shopId), eq(staffTable.active, true))), db.select().from(servicesTable).where(and(eq(servicesTable.shopId, shopId), eq(servicesTable.active, true)))]);
  return { team: team.length, services: services.length };
}
