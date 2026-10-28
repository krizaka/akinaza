import { type ShopStarterId, shopStarters } from "@krizaka/ui/shop";
import { eq } from "drizzle-orm";

import type { Db } from "./client";
import { type MediaInput, saveShopMedia } from "./service-shop";
import { shops } from "./schema";
import { publishedShopPage, publishShopPageDraft, saveShopPageDraft } from "./shop-page-versions";

/**
 * The two demo shops' page (akinaza#403, #404): the photos of the shop-page ADR (generated, in the Krizaka banner style, no faces, on the media CDN under
 * `sites/akinaza/demo/`) and the document each publishes. The other compositions of the trade are offered by the public switch
 * (`demoLooksOf`), not stored. Seeded through the product's own operations; a second run changes nothing it already holds.
 */
const CDN = "https://krizaka-assets.b-cdn.net/sites/akinaza/demo";

/** The CDN address of a demo photo: `<name>.<10 hex of its SHA-256>.webp`, a URL that never changes content. */
const photo = (name: string, hash: string) => `${CDN}/${name}.${hash}.webp`;

type Shot = Pick<MediaInput, "url" | "altFr" | "altEn" | "captionFr" | "captionEn">;

export interface DemoPage {
  /** The shop's address (the demo's slug). */
  slug: string;
  starter: ShopStarterId;
  cover: Shot;
  gallery: Shot[];
}

export const DEMO_PAGES: readonly DemoPage[] = [
  {
    slug: "cedre-ciseaux",
    starter: "salonCompact",
    cover: { url: photo("salon-cover", "dfc17581a8"), altFr: "Le salon, vu de la porte : trois fauteuils devant de grands miroirs", altEn: "The salon seen from the door: three chairs in front of big mirrors" },
    gallery: [
      { url: photo("salon-chair", "4df3bb0234"), altFr: "Un fauteuil de coiffure devant le miroir", altEn: "A hairdressing chair in front of the mirror", captionFr: "Le fauteuil", captionEn: "The chair" },
      { url: photo("salon-tools", "81031c1f8d"), altFr: "Ciseaux et peigne sur le comptoir en bois", altEn: "Scissors and a comb on the wooden counter", captionFr: "Ciseaux et peigne", captionEn: "Scissors and comb" },
      { url: photo("salon-colour", "042945a98b"), altFr: "Un bol de couleur et son pinceau", altEn: "A colour bowl and its brush", captionFr: "La couleur", captionEn: "Colour" },
      { url: photo("salon-mirror", "db7697793d"), altFr: "Le grand miroir du salon, sa lumière du matin", altEn: "The salon's big mirror in the morning light" },
      { url: photo("salon-basin", "1533cb757b"), altFr: "Le bac à shampoing", altEn: "The shampoo basin" },
      { url: photo("salon-towels", "6022ec9cf7"), altFr: "Des serviettes chaudes, pliées", altEn: "Warm towels, folded", captionFr: "Serviettes chaudes", captionEn: "Hot towels" },
      { url: photo("salon-brushes", "f621d129e4"), altFr: "Des brosses rangées au mur", altEn: "Brushes hung on the wall" },
      { url: photo("salon-shelf", "9827f05cf8"), altFr: "L'étagère des produits", altEn: "The product shelf" },
      { url: photo("salon-station", "eb6e99b10a"), altFr: "Un poste de travail prêt pour la première cliente", altEn: "A work station ready for the first client" },
    ],
  },
  {
    slug: "pattes-saint-henri",
    starter: "petsRoute",
    cover: { url: photo("pets-cover", "18173bdfbf"), altFr: "Le canal Lachine au petit matin, le chemin de la promenade", altEn: "The Lachine canal at dawn, the walk's path" },
    gallery: [
      { url: photo("pets-canal", "e710e6cd0d"), altFr: "Le chemin du canal", altEn: "The canal path", captionFr: "Le canal", captionEn: "The canal" },
      { url: photo("pets-leash", "f6f96137c9"), altFr: "Une laisse accrochée à la porte", altEn: "A leash hanging by the door", captionFr: "La laisse", captionEn: "The leash" },
      { url: photo("pets-ball", "61b264c8bf"), altFr: "Une balle dans l'herbe", altEn: "A ball in the grass" },
      { url: photo("pets-door", "0dec425388"), altFr: "La porte d'entrée, le tapis, les bottes", altEn: "The front door, the mat, the boots" },
      { url: photo("pets-leaves", "6b5b489f89"), altFr: "Des feuilles d'automne sur le trottoir", altEn: "Autumn leaves on the pavement" },
      { url: photo("pets-snow", "02ca68ac48"), altFr: "Des traces de pattes dans la neige", altEn: "Paw prints in the snow", captionFr: "Dans la neige", captionEn: "In the snow" },
      { url: photo("pets-stairs", "a0de15a260"), altFr: "L'escalier d'un duplex de Saint-Henri", altEn: "The stairs of a Saint-Henri duplex" },
    ],
  },
];

const media = (s: Shot, wide = false): MediaInput => ({ ...s, wide });

/** Puts the demo's photos on the shop and publishes its document once (the same document is never published twice). */
export async function seedDemoPage(db: Db, shopId: string, demo: DemoPage): Promise<{ photos: number; published: boolean }> {
  await saveShopMedia(db, shopId, { cover: media(demo.cover, true), gallery: demo.gallery.map((g) => media(g)) });
  const target = structuredClone(shopStarters[demo.starter]);
  const { page, version } = await publishedShopPage(db, shopId);
  if (version !== null && JSON.stringify(page) === JSON.stringify(target)) return { photos: demo.gallery.length + 1, published: false };
  await saveShopPageDraft(db, shopId, target, null);
  await publishShopPageDraft(db, shopId, null);
  return { photos: demo.gallery.length + 1, published: true };
}

/** Every demo shop that exists in this database gets its page (a shop that is not there is skipped: the seeds of the others create them). */
export async function seedDemoPages(db: Db): Promise<{ slug: string; photos: number; published: boolean }[]> {
  const out = [];
  for (const demo of DEMO_PAGES) {
    const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, demo.slug));
    if (shop) out.push({ slug: demo.slug, ...(await seedDemoPage(db, shop.id, demo)) });
  }
  return out;
}
