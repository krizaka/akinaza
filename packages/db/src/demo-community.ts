import { and, eq } from "drizzle-orm";

import type { Db } from "./client";
import media from "./demo-media.json";
import { addAnnouncement, addExternalReel, addReview, addUploadedReel, announcementsOf, reelsOf, reviewsOf, saveSocialLinks, saveWall, socialLinksOf, wallOf } from "./shop-community";
import { shops } from "./schema";

/**
 * The demo shops as places (B45): a wall of photos, cards and the sign, the latest reel, a public Short behind its facade, the profile links, the bulletin
 * board and eight verified reviews. Media are on the CDN (`sites/akinaza/demo/<slug>/`, uploaded with krizaka-com's `cdn-assets`, never committed);
 * the people in the words are invented, like the shops. Through the product's own operations; idempotent: whatever the owner already pinned is left alone.
 */
type Demo = typeof media;
type DemoSlug = keyof Demo;

interface Pinned { photo: number; x: number; y: number; rotation: number; z: number; attachment: "tape" | "pin" }
interface Words { fr: string; en: string }

const COMMUNITY: Record<DemoSlug, {
  texture: "brick" | "plaster";
  photos: Pinned[];
  note: { x: number; y: number; rotation: number; z: number; text: Words; signature: string };
  sign: { x: number; y: number; z: number; variant: "enamel" | "neon" | "painted" };
  links: { instagram: string; tiktok: string };
  external: { url: string; titleFr: string; titleEn: string };
  announcements: Words[];
  reviews: { firstName: string; lastInitial: string; rating: number; body: string; serviceName: string }[];
}> = {
  "cedre-ciseaux": {
    texture: "brick",
    photos: [
      { photo: 0, x: 4, y: 8, rotation: -3, z: 1, attachment: "tape" },
      { photo: 1, x: 30, y: 36, rotation: 2, z: 2, attachment: "pin" },
      { photo: 2, x: 56, y: 6, rotation: -2, z: 3, attachment: "tape" },
      { photo: 3, x: 74, y: 40, rotation: 3, z: 4, attachment: "tape" },
      { photo: 4, x: 8, y: 52, rotation: 2, z: 5, attachment: "pin" },
    ],
    note: { x: 52, y: 52, rotation: -2, z: 6, text: { fr: "Merci à toutes et à tous : les cafés sont offerts le samedi !", en: "Thank you all: coffee is on us on Saturdays!" }, signature: "Maëlle" },
    sign: { x: 78, y: 4, z: 7, variant: "enamel" },
    links: { instagram: "https://www.instagram.com/cedre.ciseaux.demo", tiktok: "https://www.tiktok.com/@cedre.ciseaux.demo" },
    external: { url: "https://www.youtube.com/shorts/sOpin6X2--0", titleFr: "Exemple d'un lien YouTube Shorts (vidéo d'une autre chaîne)", titleEn: "Example of a YouTube Shorts link (another channel's video)" },
    announcements: [
      { fr: "Portes ouvertes le premier samedi du mois : café, thé à la menthe et conseils coupe gratuits.", en: "Open house on the first Saturday of the month: coffee, mint tea and free cut advice." },
      { fr: "Une coloriste nous rejoint cet automne. Les balayages se réservent déjà en ligne.", en: "A colourist joins us this autumn. Balayages can already be booked online." },
    ],
    reviews: [
      { firstName: "Camille", lastInitial: "T", rating: 5, body: "Une coupe exactement comme je l'avais imaginée. Maëlle prend vraiment le temps d'écouter.", serviceName: "Coupe et brushing" },
      { firstName: "Karim", lastInitial: "B", rating: 5, body: "Barbe nette, serviette chaude, rendez-vous à l'heure. Je reviens.", serviceName: "Barbe" },
      { firstName: "Inès", lastInitial: "R", rating: 4, body: "Très bon balayage, un peu long mais le résultat est naturel.", serviceName: "Balayage" },
      { firstName: "Jordan", lastInitial: "L", rating: 5, body: "Réservé en trois clics, une coupe courte parfaite.", serviceName: "Coupe courte" },
      { firstName: "Sophie", lastInitial: "M", rating: 5, body: "Salon lumineux, équipe attentionnée. Ma couleur tient depuis deux mois.", serviceName: "Couleur complète" },
      { firstName: "Marc", lastInitial: "D", rating: 4, body: "Bon accueil et prix annoncés avant. J'aurais aimé un créneau plus tard le soir.", serviceName: "Coupe courte" },
      { firstName: "Léa", lastInitial: "P", rating: 5, body: "Jade a su me conseiller sans m'imposer quoi que ce soit.", serviceName: "Coupe et brushing" },
      { firstName: "Nadia", lastInitial: "F", rating: 5, body: "Le meilleur brushing du quartier, simplement.", serviceName: "Coupe et brushing" },
    ],
  },
  "pattes-saint-henri": {
    texture: "plaster",
    photos: [
      { photo: 0, x: 5, y: 10, rotation: -3, z: 1, attachment: "tape" },
      { photo: 1, x: 32, y: 34, rotation: 2, z: 2, attachment: "pin" },
      { photo: 2, x: 58, y: 8, rotation: -2, z: 3, attachment: "tape" },
      { photo: 3, x: 76, y: 42, rotation: 3, z: 4, attachment: "tape" },
      { photo: 5, x: 8, y: 54, rotation: 2, z: 5, attachment: "pin" },
    ],
    note: { x: 54, y: 54, rotation: -2, z: 6, text: { fr: "Après chaque sortie : une photo, un mot, de l'eau fraîche et une serviette.", en: "After every outing: a photo, a note, fresh water and a towel-down." }, signature: "Léa" },
    sign: { x: 78, y: 4, z: 7, variant: "painted" },
    links: { instagram: "https://www.instagram.com/pattes.saint.henri.demo", tiktok: "https://www.tiktok.com/@pattes.saint.henri.demo" },
    external: { url: "https://www.youtube.com/shorts/Uayf5N9WRVY", titleFr: "Exemple d'un lien YouTube Shorts (vidéo d'une autre chaîne)", titleEn: "Example of a YouTube Shorts link (another channel's video)" },
    announcements: [
      { fr: "Places ouvertes pour les promenades du matin à Griffintown dès lundi prochain.", en: "Morning walks in Griffintown now have open places from next Monday." },
      { fr: "Visite chiot : la première est à moitié prix pour les nouveaux venus du quartier.", en: "Puppy visit: the first one is half price for newcomers to the neighbourhood." },
    ],
    reviews: [
      { firstName: "Camille", lastInitial: "T", rating: 5, body: "Rex rentre fatigué et heureux, et le petit mot après la promenade fait vraiment plaisir.", serviceName: "Promenade en groupe 60 min" },
      { firstName: "Jordan", lastInitial: "L", rating: 5, body: "Luna adore Léa. Photos, horaires respectés, rien à redire.", serviceName: "Promenade solo 60 min" },
      { firstName: "Émilie", lastInitial: "G", rating: 5, body: "Notre chiot était anxieux, la visite chiot l'a vraiment rassuré.", serviceName: "Visite chiot 20 min" },
      { firstName: "Antoine", lastInitial: "V", rating: 4, body: "Très fiable. Les promenades en groupe se remplissent vite, réservez tôt.", serviceName: "Promenade en groupe 60 min" },
      { firstName: "Sarah", lastInitial: "K", rating: 5, body: "Départ et retour à la porte, eau fraîche, serviette : tout est prévu.", serviceName: "Promenade solo 30 min" },
      { firstName: "Mathieu", lastInitial: "C", rating: 5, body: "Érable la prend pour sa meilleure amie.", serviceName: "Promenade en groupe 60 min" },
      { firstName: "Julie", lastInitial: "A", rating: 4, body: "Super service, j'aimerais des plages en soirée.", serviceName: "Promenade solo 30 min" },
      { firstName: "Hugo", lastInitial: "N", rating: 5, body: "On sent que les chiens sont en confiance. Merci Léa !", serviceName: "Promenade solo 60 min" },
    ],
  },
};

/** The second clip of every demo playlist: Akinaza's own recording of the report the client receives (7 s, phone), on the CDN. */
const REPORT_CLIP = {
  webm: "https://krizaka-assets.b-cdn.net/sites/akinaza/tour/report.47b4fef558.webm",
  mp4: "https://krizaka-assets.b-cdn.net/sites/akinaza/tour/report.b1f25d285f.mp4",
  poster: "https://krizaka-assets.b-cdn.net/sites/akinaza/tour/phone-report.af3aa7b92b.jpg",
  seconds: 7.3,
};

export const isDemoCommunitySlug = (slug: string): slug is DemoSlug => slug in COMMUNITY;

/** Gives a demo shop its place: each part only when the owner has not pinned anything of their own yet. */
export async function seedDemoCommunity(db: Db, shopId: string, slug: string): Promise<void> {
  if (!isDemoCommunitySlug(slug)) return;
  const plan = COMMUNITY[slug];
  const files = media[slug];
  if ((await wallOf(db, shopId)).items.length === 0) {
    const photo = (i: number) => files.wall[i]!;
    await saveWall(db, shopId, {
      texture: plan.texture,
      items: [
        ...plan.photos.map((p) => ({ kind: "polaroid", x: p.x, y: p.y, rotation: p.rotation, z: p.z, attachment: p.attachment, imageUrl: photo(p.photo).url, altFr: photo(p.photo).altFr, altEn: photo(p.photo).altEn, captionFr: photo(p.photo).captionFr, captionEn: photo(p.photo).captionEn })),
        { kind: "note", x: plan.note.x, y: plan.note.y, rotation: plan.note.rotation, z: plan.note.z, attachment: "pin", textFr: plan.note.text.fr, textEn: plan.note.text.en, signature: plan.note.signature },
        { kind: "sign", x: plan.sign.x, y: plan.sign.y, rotation: 0, z: plan.sign.z, variant: plan.sign.variant },
      ],
    }, 24);
  }
  if ((await reelsOf(db, shopId)).length === 0) {
    // The playlist: the shop's own reel first (it plays in the television), then a public Short behind its facade.
    await addUploadedReel(db, shopId, { mp4Url: files.reel.mp4, webmUrl: files.reel.webm, posterUrl: files.reel.poster, seconds: files.reel.seconds, titleFr: "La semaine au salon", titleEn: "A week at the shop" });
    await addUploadedReel(db, shopId, { mp4Url: REPORT_CLIP.mp4, webmUrl: REPORT_CLIP.webm, posterUrl: REPORT_CLIP.poster, seconds: REPORT_CLIP.seconds, titleFr: "Ce que reçoit le client", titleEn: "What the client receives" });
    await addExternalReel(db, shopId, plan.external.url, { titleFr: plan.external.titleFr, titleEn: plan.external.titleEn, posterUrl: files.reel.poster });
  }
  const links = await socialLinksOf(db, shopId);
  await saveSocialLinks(db, shopId, Object.fromEntries(Object.entries(plan.links).filter(([platform]) => !(platform in links))));
  if ((await announcementsOf(db, shopId)).length === 0) {
    for (const a of [...plan.announcements].reverse()) await addAnnouncement(db, shopId, { textFr: a.fr, textEn: a.en, photoUrl: null, photoAlt: "", endsOn: null });
  }
  if ((await reviewsOf(db, shopId)).length === 0) {
    for (const review of plan.reviews) await addReview(db, shopId, { ...review, verified: true });
  }
}

/** The demo community of the shop with this address, if it is one of the demo shops. */
export async function seedDemoCommunityBySlug(db: Db, slug: string): Promise<boolean> {
  const [shop] = await db.select({ id: shops.id }).from(shops).where(and(eq(shops.slug, slug), eq(shops.published, true)));
  if (!shop) return false;
  await seedDemoCommunity(db, shop.id, slug);
  return true;
}
