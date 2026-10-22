import { createOrganize, OrganizeError, type OrganizeSchema } from "@krizaka/organize";

export { OrganizeError };

/**
 * « organize » for Akinaza (ADR-006, `@krizaka/organize`): a shop is an item. Its name, description, avatar and tags, and its place in
 * the owner's collections, come from the package; the shop's business (hours, staff, services, rules) stays Akinaza's own tables.
 * The « default shop » (`shops.is_default`) is something else: the shop the app opens on, not the default collection.
 */
export const ORGANIZE_SCHEMA: OrganizeSchema = {
  kinds: { shop: { table: "shops", tagTable: "shop_tags", tagColumn: "shop_id" } },
  defaultName: { fr: "Mes commerces", en: "My shops" },
};

/** The avatars an owner may pick for a shop or a collection (the UI draws a seed): the package's set, not an uploaded image. */
export const SHOP_AVATAR_SEEDS = ["plain-1", "plain-2", "plain-3", "plain-4", "plain-5", "plain-6"] as const;

/** A SQL executor: the rows of a statement with its parameters (the app's pool, a test's client). */
export type SqlQuery = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export const organizeOver = (query: SqlQuery) => createOrganize({ query: (sql, params) => query(sql, params) as Promise<never>, schema: ORGANIZE_SCHEMA });
