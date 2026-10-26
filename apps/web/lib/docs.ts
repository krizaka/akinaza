import { DOC_IDS, type DocId, pagePath } from "./site";

/**
 * The owner's guide (akinaza#382): five pages, one job each. The structure is here (ids, order, where the app's « Help »
 * links lead); the words are `docs.*` in the messages, in both languages.
 */
export { DOC_IDS, type DocId };

export const isDocId = (value: string): value is DocId => (DOC_IDS as readonly string[]).includes(value);

export const docHref = (locale: "en" | "fr", id: DocId) => pagePath(locale, `docs/${id}`);

/** The part of the app a « Help » link sits in, and the guide page that explains it. */
export const HELP_AREAS = {
  boutique: "shop",
  today: "bookings",
  invoices: "invoices",
  books: "books",
  data: "data",
} as const satisfies Record<string, DocId>;
export type HelpArea = keyof typeof HELP_AREAS;

/** Where an in-app « Help » link leads. */
export const helpHref = (locale: "en" | "fr", area: HelpArea) => docHref(locale, HELP_AREAS[area]);

/** The previous and next page of the guide, in reading order. */
export function neighbours(id: DocId): { previous: DocId | null; next: DocId | null } {
  const i = DOC_IDS.indexOf(id);
  return { previous: DOC_IDS[i - 1] ?? null, next: DOC_IDS[i + 1] ?? null };
}
