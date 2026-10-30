// What Krizaka says on its page in Akinaza (akinaza#489): the company is Akinaza's first real client, and it enters this through the owner
// console like any client. Only what is true today: three products, all in development, and one offer on quote (no price is invented).
export const SHOP = {
  name: "Krizaka",
  legalName: "Technologies Krizaka inc.",
  ownerName: "Oussama",
  address: "Montréal QC",
  slug: "krizaka",
  area: "Montréal",
  publicEmail: "bonjour@krizaka.com",
  taglineFr: "Des outils de logiciel faits à Montréal : Yomizaka, Akinaza et Orazaka.",
  taglineEn: "Software tools made in Montréal: Yomizaka, Akinaza and Orazaka.",
  bioFr: "Krizaka est une entreprise de logiciel de Montréal. Nous construisons trois produits, tous en développement et bâtis au grand jour, et nous accompagnons les équipes qui veulent adopter l'IA sans perdre la maîtrise de leurs données.",
  bioEn: "Krizaka is a software company in Montréal. We build three products, all in development and built in the open, and we help teams adopt AI without losing control of their data.",
  seatUnitFr: "personnes",
  seatUnitEn: "people",
};

/** Every product is « in development » (nothing is sold yet); the Entreprise offer is the one thing on quote. A 0 $ price that « varies » reads « On quote ». */
const NOT_ON_SALE = { fr: ["Le code est public", "Pas encore en vente"], en: ["The code is public", "Not on sale yet"] };

/** A product of the family, in development: its sentence in both languages, its site, and the one thing it promises. */
function product(name, host, [whatFr, whatEn], [promiseFr, promiseEn]) {
  return {
    nameFr: name,
    nameEn: name,
    descriptionFr: `En développement. ${whatFr} Voir ${host}.`,
    descriptionEn: `In development. ${whatEn} See ${host}.`,
    includedFr: [promiseFr, ...NOT_ON_SALE.fr],
    includedEn: [promiseEn, ...NOT_ON_SALE.en],
  };
}

export const OFFERS = [
  product("Yomizaka", "dev.yomizaka.com", ["Yomizaka lit un bail ou un document et en tire ce qui compte.", "Yomizaka reads a lease or a document and pulls out what matters."], ["Un produit bâti au grand jour", "A product built in the open"]),
  product("Akinaza", "dev.akinaza.com", ["Akinaza donne une page, des rendez-vous, des factures et des livres aux petites entreprises de services.", "Akinaza gives small service businesses a page, bookings, invoices and books."], ["Elle prépare vos taxes, vous les produisez", "It prepares your taxes, you file them"]),
  product("Orazaka", "dev.orazaka.com", ["Orazaka est le moteur d'IA souverain sur lequel nos produits s'appuient.", "Orazaka is the sovereign AI engine our products run on."], ["Un moteur que vous hébergez vous-même", "An engine you host yourself"]),
  {
    nameFr: "Krizaka Entreprise",
    nameEn: "Krizaka Entreprise",
    descriptionFr: "Des modules sur mesure, l'adoption d'une IA souveraine et la maintenance. Sur devis : écrivez-nous.",
    descriptionEn: "Custom modules, sovereign AI adoption and maintenance. On quote: write to us.",
    includedFr: ["Modules sur mesure", "Adoption d'une IA souveraine", "Maintenance"],
    includedEn: ["Custom modules", "Sovereign AI adoption", "Maintenance"],
  },
].map((offer) => ({ ...offer, durationMinutes: 30, priceCents: 0, priceVaries: true, capacity: 1 }));

/** The photos (from the studio's photo, cropped without the wall posters and the drawn portraits, and the family's skyline banner). Alt texts in both languages. */
export const PHOTOS = [
  { file: "krizaka-sheet.jpg", altFr: "La feuille « Krizaka, fait à Montréal » posée sur la table de l'atelier", altEn: "The “Krizaka, made in Montréal” sheet on the studio table", captionFr: "Fait à Montréal", captionEn: "Made in Montréal", cover: false },
  { file: "krizaka-laptop.jpg", altFr: "Un portable avec du code dans l'atelier", altEn: "A laptop showing code in the studio", captionFr: "Du code ouvert", captionEn: "Code in the open", cover: false },
  { file: "krizaka-skyline.jpg", altFr: "Une silhouette de bâtiments de Montréal la nuit, sous la lune", altEn: "A skyline of Montréal buildings at night, under the moon", cover: true },
];
export const LOGO = { file: "mark-light-512.png" };
