import { CHECKED_STATES, checkDomain, type CustomHostnames, DOMAIN_ERROR, DOMAIN_STATE, type DomainLimits, newDomainToken, readHostname, type TxtResolver } from "@akinaza/core";
import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { shopDomains, shops } from "./schema";

/**
 * Merchants' own domains (ADR-005 §3, akinaza#539). The option is paid and enabled per shop by an administrator; the owner then adds a hostname,
 * proves it with a TXT record, and the edge service issues its certificate. A domain is served only when `active`, only while the option is on and the
 * shop is published. Every function takes the shop it works on: another shop's domain is simply not found.
 */

export type ShopDomain = typeof shopDomains.$inferSelect;

export const DOMAIN_CODE = {
  optionOff: "AK_DOMAIN_OPTION_OFF",
  invalid: "AK_DOMAIN_INVALID",
  limit: "AK_DOMAIN_LIMIT",
  exists: "AK_DOMAIN_EXISTS",
  taken: "AK_DOMAIN_TAKEN",
  notFound: "AK_DOMAIN_NOT_FOUND",
  tooSoon: "AK_DOMAIN_TOO_SOON",
} as const;

const UNIQUE_VIOLATION = "23505";
const isUniqueViolation = (error: unknown): boolean => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION;
};

/** Enables or disables the option for a shop (an administrator; the caller audits). Disabling suspends every live domain and returns the edge ids to release; enabling puts them back through the proof. */
export async function setCustomDomainOption(db: Db, shopId: string, enabled: boolean, priceVersion: string | null, now: Date): Promise<{ release: string[] }> {
  return db.transaction(async (tx) => {
    const [shop] = await tx.update(shops).set(enabled ? { customDomainEnabled: true, customDomainPriceVersion: priceVersion, customDomainEnabledAt: now } : { customDomainEnabled: false }).where(eq(shops.id, shopId)).returning({ id: shops.id });
    if (!shop) throw new ShopError(DOMAIN_CODE.notFound);
    if (enabled) {
      await tx.update(shopDomains).set({ state: DOMAIN_STATE.pendingTxt, attempts: 0, lastError: null, providerId: null, updatedAt: now }).where(and(eq(shopDomains.shopId, shopId), eq(shopDomains.state, DOMAIN_STATE.suspended), eq(shopDomains.lastError, DOMAIN_ERROR.optionOff)));
      return { release: [] };
    }
    const live = await tx.select({ id: shopDomains.id, providerId: shopDomains.providerId }).from(shopDomains).where(and(eq(shopDomains.shopId, shopId), inArray(shopDomains.state, [...CHECKED_STATES])));
    if (live.length) await tx.update(shopDomains).set({ state: DOMAIN_STATE.suspended, lastError: DOMAIN_ERROR.optionOff, providerId: null, updatedAt: now }).where(inArray(shopDomains.id, live.map((d) => d.id)));
    return { release: live.flatMap((d) => (d.providerId ? [d.providerId] : [])) };
  });
}

export async function listShopDomains(db: Db, shopId: string): Promise<ShopDomain[]> {
  return db.select().from(shopDomains).where(and(eq(shopDomains.shopId, shopId), ne(shopDomains.state, DOMAIN_STATE.removed))).orderBy(asc(shopDomains.createdAt));
}

/** The owner adds a hostname. `max` is the catalogue's limit for the option. The new row gets a token of its own: a domain released by one shop is never inherited. */
export async function addShopDomain(db: Db, shopId: string, input: string, opts: { max: number; random: (bytes: number) => Uint8Array }): Promise<ShopDomain> {
  const read = readHostname(input);
  if (!read.ok) throw new ShopError(DOMAIN_CODE.invalid, read.reason);
  const [shop] = await db.select({ enabled: shops.customDomainEnabled }).from(shops).where(eq(shops.id, shopId));
  if (!shop) throw new ShopError(DOMAIN_CODE.notFound);
  if (!shop.enabled) throw new ShopError(DOMAIN_CODE.optionOff);
  const mine = await listShopDomains(db, shopId);
  if (mine.some((d) => d.hostname === read.hostname)) throw new ShopError(DOMAIN_CODE.exists);
  if (mine.length >= opts.max) throw new ShopError(DOMAIN_CODE.limit);
  const [claimed] = await db.select({ id: shopDomains.id }).from(shopDomains).where(and(eq(shopDomains.hostname, read.hostname), inArray(shopDomains.state, [DOMAIN_STATE.pendingTls, DOMAIN_STATE.active])));
  if (claimed) throw new ShopError(DOMAIN_CODE.taken);
  const [row] = await db.insert(shopDomains).values({ shopId, hostname: read.hostname, token: newDomainToken(opts.random) }).returning();
  return row!;
}

/** The owner (or an administrator) removes a domain: it stops being served at once; the edge id, if any, is returned to release. */
export async function removeShopDomain(db: Db, shopId: string, domainId: string, now: Date): Promise<{ hostname: string; release: string | null }> {
  const [row] = await db.update(shopDomains).set({ state: DOMAIN_STATE.removed, updatedAt: now }).where(and(eq(shopDomains.id, domainId), eq(shopDomains.shopId, shopId), ne(shopDomains.state, DOMAIN_STATE.removed))).returning();
  if (!row) throw new ShopError(DOMAIN_CODE.notFound);
  return { hostname: row.hostname, release: row.providerId };
}

/** A failed domain tries again from the proof, with a new waiting window (same token: the records the owner added stay valid). */
export async function retryShopDomain(db: Db, shopId: string, domainId: string, now: Date): Promise<void> {
  const [row] = await db.update(shopDomains).set({ state: DOMAIN_STATE.pendingTxt, attempts: 0, lastError: null, providerId: null, createdAt: now, updatedAt: now }).where(and(eq(shopDomains.id, domainId), eq(shopDomains.shopId, shopId), eq(shopDomains.state, DOMAIN_STATE.failed))).returning({ id: shopDomains.id });
  if (!row) throw new ShopError(DOMAIN_CODE.notFound);
}

export interface DomainPorts {
  dns: TxtResolver;
  hostnames: CustomHostnames;
  now: Date;
  limits: DomainLimits;
}

/** One domain, checked now: the state machine's step is written back; a hostname claimed meanwhile by another shop turns this one `failed` (taken). */
export async function checkShopDomain(db: Db, row: ShopDomain, ports: DomainPorts): Promise<ShopDomain> {
  const step = await checkDomain(row, ports);
  if (step.release && row.providerId) await ports.hostnames.remove(row.providerId).catch((): void => undefined);
  const next = { ...step, providerId: step.release ? null : step.providerId };
  const base = { lastCheckedAt: ports.now, updatedAt: ports.now, attempts: next.attempts, lastError: next.error, providerId: next.providerId };
  const verified = next.state === DOMAIN_STATE.pendingTls && row.state === DOMAIN_STATE.pendingTxt ? { verifiedAt: ports.now } : {};
  try {
    const [saved] = await db.update(shopDomains).set({ ...base, ...verified, state: next.state }).where(and(eq(shopDomains.id, row.id), eq(shopDomains.state, row.state))).returning();
    return saved ?? row;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    if (next.providerId) await ports.hostnames.remove(next.providerId).catch((): void => undefined);
    const [saved] = await db.update(shopDomains).set({ ...base, state: DOMAIN_STATE.failed, providerId: null, lastError: DOMAIN_ERROR.taken }).where(eq(shopDomains.id, row.id)).returning();
    return saved ?? row;
  }
}

/** The owner's « check now »: one domain of the shop, no more often than `minIntervalMs` (verification retries are limited, ADR-005 §8). */
export async function checkShopDomainNow(db: Db, shopId: string, domainId: string, ports: DomainPorts, minIntervalMs: number): Promise<ShopDomain> {
  const [row] = await db.select().from(shopDomains).where(and(eq(shopDomains.id, domainId), eq(shopDomains.shopId, shopId)));
  if (!row || row.state === DOMAIN_STATE.removed) throw new ShopError(DOMAIN_CODE.notFound);
  if (row.lastCheckedAt && row.lastCheckedAt.valueOf() + minIntervalMs > ports.now.valueOf()) throw new ShopError(DOMAIN_CODE.tooSoon);
  return checkShopDomain(db, row, ports);
}

/** The periodic tick: the domains not checked for `everyMs`, oldest first, at most `batch`; a shop whose option is off is never worked on. */
export async function checkDueDomains(db: Db, ports: DomainPorts, opts: { everyMs: number; batch: number }): Promise<number> {
  const before = new Date(ports.now.valueOf() - opts.everyMs);
  const due = await db
    .select({ d: shopDomains })
    .from(shopDomains)
    .innerJoin(shops, eq(shops.id, shopDomains.shopId))
    .where(and(inArray(shopDomains.state, [...CHECKED_STATES]), eq(shops.customDomainEnabled, true), or(isNull(shopDomains.lastCheckedAt), lt(shopDomains.lastCheckedAt, before))))
    .orderBy(sql`${shopDomains.lastCheckedAt} NULLS FIRST`)
    .limit(opts.batch);
  for (const { d } of due) await checkShopDomain(db, d, ports);
  return due.length;
}

/**
 * The shop a custom host serves (the proxy's question): only an `active` domain of a shop with the option on and a published page. Anything else is
 * none, so a suspended, pending, removed or unpaid domain is a 421 within the proxy's cache time.
 */
export async function shopOfCustomHost(db: Db, hostname: string): Promise<{ slug: string } | null> {
  const [row] = await db
    .select({ slug: shops.slug })
    .from(shopDomains)
    .innerJoin(shops, eq(shops.id, shopDomains.shopId))
    .where(and(eq(shopDomains.hostname, hostname.toLowerCase()), eq(shopDomains.state, DOMAIN_STATE.active), eq(shops.customDomainEnabled, true), eq(shops.published, true)));
  return row?.slug ? { slug: row.slug } : null;
}

/** The shop's canonical custom domain, once verified (the oldest active one): the pages' canonical and the 308 target of every other address. */
export async function activeDomainOf(db: Db, shopId: string): Promise<string | null> {
  const [row] = await db.select({ hostname: shopDomains.hostname }).from(shopDomains).innerJoin(shops, eq(shops.id, shopDomains.shopId)).where(and(eq(shopDomains.shopId, shopId), eq(shopDomains.state, DOMAIN_STATE.active), eq(shops.customDomainEnabled, true))).orderBy(asc(shopDomains.verifiedAt)).limit(1);
  return row?.hostname ?? null;
}

export interface DomainOverview extends ShopDomain {
  shopName: string;
  shopSlug: string | null;
  optionEnabled: boolean;
}

/** The console's view: every domain not removed, with its shop. */
export async function domainsOverview(db: Db): Promise<DomainOverview[]> {
  const rows = await db.select({ d: shopDomains, shopName: shops.name, shopSlug: shops.slug, optionEnabled: shops.customDomainEnabled }).from(shopDomains).innerJoin(shops, eq(shops.id, shopDomains.shopId)).where(ne(shopDomains.state, DOMAIN_STATE.removed)).orderBy(asc(shopDomains.createdAt));
  return rows.map((r) => ({ ...r.d, shopName: r.shopName, shopSlug: r.shopSlug, optionEnabled: r.optionEnabled }));
}

/** The same, for a shop named by its slug (the proxy's lookup of a shop host). */
export async function activeDomainOfSlug(db: Db, slug: string): Promise<string | null> {
  const [row] = await db.select({ hostname: shopDomains.hostname }).from(shopDomains).innerJoin(shops, eq(shops.id, shopDomains.shopId)).where(and(eq(shops.slug, slug), eq(shopDomains.state, DOMAIN_STATE.active), eq(shops.customDomainEnabled, true))).orderBy(asc(shopDomains.verifiedAt)).limit(1);
  return row?.hostname ?? null;
}
