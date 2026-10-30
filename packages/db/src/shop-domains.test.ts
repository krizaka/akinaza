import { type CustomHostnames, DOMAIN_STATE, txtRecordValue } from "@akinaza/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { shopDomains, shops } from "./schema";
import { saveShopPage, ShopError } from "./service-shop";
import { activeDomainOf, addShopDomain, checkDueDomains, checkShopDomain, checkShopDomainNow, DOMAIN_CODE, domainsOverview, listShopDomains, removeShopDomain, retryShopDomain, setCustomDomainOption, shopOfCustomHost } from "./shop-domains";
import { freshDatabase } from "./test/db";
import { account } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const NOW = new Date("2026-10-30T12:00:00Z");
const limits = { maxAttempts: 3, lapseAttempts: 3, waitMs: 72 * 3600_000 };
let n = 0;

async function shop(published = true) {
  n += 1;
  const owner = await account(t.db, `domains${n}@example.test`);
  const { shopId } = await saveShopPage(t.db, owner.id, { name: "Salon", legalName: "Salon", address: "1 rue Test", slug: `salon-dom-${n}`, ownerName: "Éric" });
  await t.db.update(shops).set({ published }).where(eq(shops.id, shopId));
  return shopId;
}

/** The DNS holds whatever the test puts in it; the edge service is a recorder. */
function world() {
  const records = new Map<string, string[]>();
  const created: string[] = [];
  const removed: string[] = [];
  let tls: "pending" | "active" | "failed" = "pending";
  const hostnames: CustomHostnames = {
    create: async (h) => { created.push(h); return { id: `ch_${h}`, tls: "pending" }; },
    status: async (id) => ({ id, tls }),
    remove: async (id) => { removed.push(id); },
  };
  const ports = (now = NOW) => ({ dns: { txt: async (name: string) => records.get(name) ?? [] }, hostnames, now, limits });
  return { records, created, removed, ports, setTls: (v: typeof tls) => { tls = v; } };
}

describe("merchants' own domains (real PostgreSQL 16, #539)", () => {
  it("refuses a domain while the option is off, then accepts it once an administrator enables it", async () => {
    const id = await shop();
    await expect(addShopDomain(t.db, id, "reservation.monsalon.ca", { max: 5, random })).rejects.toMatchObject({ code: DOMAIN_CODE.optionOff });
    await setCustomDomainOption(t.db, id, true, "v1", NOW);
    const row = await addShopDomain(t.db, id, "https://Reservation.MonSalon.ca/", { max: 5, random });
    expect(row).toMatchObject({ hostname: "reservation.monsalon.ca", state: DOMAIN_STATE.pendingTxt });
    expect(row.token).toMatch(/^[0-9a-f]{48}$/);
    const [shopRow] = await t.db.select().from(shops).where(eq(shops.id, id));
    expect(shopRow).toMatchObject({ customDomainEnabled: true, customDomainPriceVersion: "v1" });
  });

  it("limits the domains per shop, and refuses a malformed or duplicate hostname", async () => {
    const id = await shop();
    await setCustomDomainOption(t.db, id, true, null, NOW);
    await addShopDomain(t.db, id, "a.monsalon.ca", { max: 2, random });
    await expect(addShopDomain(t.db, id, "a.monsalon.ca", { max: 2, random })).rejects.toMatchObject({ code: DOMAIN_CODE.exists });
    await addShopDomain(t.db, id, "b.monsalon.ca", { max: 2, random });
    await expect(addShopDomain(t.db, id, "c.monsalon.ca", { max: 2, random })).rejects.toMatchObject({ code: DOMAIN_CODE.limit });
    await expect(addShopDomain(t.db, id, "login.akinaza.com", { max: 9, random })).rejects.toBeInstanceOf(ShopError);
  });

  it("goes pending TXT -> pending TLS -> active, and is served only then", async () => {
    const id = await shop();
    const w = world();
    await setCustomDomainOption(t.db, id, true, null, NOW);
    const row = await addShopDomain(t.db, id, "book.salon-serve.ca", { max: 5, random });
    expect(await shopOfCustomHost(t.db, "book.salon-serve.ca")).toBeNull();

    const missing = await checkShopDomain(t.db, row, w.ports());
    expect(missing).toMatchObject({ state: DOMAIN_STATE.pendingTxt, attempts: 1, lastError: "txt-missing" });
    expect(w.created).toEqual([]);

    w.records.set("_akinaza-verify.book.salon-serve.ca", [txtRecordValue(row.token)]);
    const proven = await checkShopDomain(t.db, missing, w.ports());
    expect(proven).toMatchObject({ state: DOMAIN_STATE.pendingTls, providerId: "ch_book.salon-serve.ca" });
    expect(proven.verifiedAt).not.toBeNull();
    expect(await shopOfCustomHost(t.db, "book.salon-serve.ca")).toBeNull();

    w.setTls("active");
    const live = await checkShopDomain(t.db, proven, w.ports());
    expect(live.state).toBe(DOMAIN_STATE.active);
    const [slug] = await t.db.select({ slug: shops.slug }).from(shops).where(eq(shops.id, id));
    expect(await shopOfCustomHost(t.db, "BOOK.salon-serve.ca")).toEqual({ slug: slug!.slug });
    expect(await activeDomainOf(t.db, id)).toBe("book.salon-serve.ca");
  });

  it("serves nothing for an unpublished shop or once the option is switched off (and releases the hostname)", async () => {
    const id = await shop();
    const w = world();
    await setCustomDomainOption(t.db, id, true, null, NOW);
    const row = await addShopDomain(t.db, id, "go.salon-off.ca", { max: 5, random });
    w.records.set("_akinaza-verify.go.salon-off.ca", [txtRecordValue(row.token)]);
    w.setTls("active");
    let cur = await checkShopDomain(t.db, row, w.ports());
    cur = await checkShopDomain(t.db, cur, w.ports());
    expect(cur.state).toBe(DOMAIN_STATE.active);
    await t.db.update(shops).set({ published: false }).where(eq(shops.id, id));
    expect(await shopOfCustomHost(t.db, "go.salon-off.ca")).toBeNull();
    await t.db.update(shops).set({ published: true }).where(eq(shops.id, id));
    expect(await shopOfCustomHost(t.db, "go.salon-off.ca")).not.toBeNull();

    const { release } = await setCustomDomainOption(t.db, id, false, null, NOW);
    expect(release).toEqual(["ch_go.salon-off.ca"]);
    expect(await shopOfCustomHost(t.db, "go.salon-off.ca")).toBeNull();
    expect(await activeDomainOf(t.db, id)).toBeNull();
    // Enabling again re-runs the proof: nothing is served on the old verdict.
    await setCustomDomainOption(t.db, id, true, null, NOW);
    const [again] = await listShopDomains(t.db, id);
    expect(again).toMatchObject({ state: DOMAIN_STATE.pendingTxt, providerId: null });
    expect(await shopOfCustomHost(t.db, "go.salon-off.ca")).toBeNull();
  });

  it("takeover: a hostname served by one shop cannot be taken by another, and a released one needs a new TXT", async () => {
    const a = await shop();
    const b = await shop();
    const w = world();
    await setCustomDomainOption(t.db, a, true, null, NOW);
    await setCustomDomainOption(t.db, b, true, null, NOW);
    const first = await addShopDomain(t.db, a, "shared.salon-take.ca", { max: 5, random });
    w.records.set("_akinaza-verify.shared.salon-take.ca", [txtRecordValue(first.token)]);
    w.setTls("active");
    await checkShopDomain(t.db, await checkShopDomain(t.db, first, w.ports()), w.ports()).then(() => undefined);
    await expect(addShopDomain(t.db, b, "shared.salon-take.ca", { max: 5, random })).rejects.toMatchObject({ code: DOMAIN_CODE.taken });

    // A removes it: B may add it, but A's token proves nothing for B, and B's row starts again at the proof.
    const [live] = await listShopDomains(t.db, a);
    expect(live!.state).toBe(DOMAIN_STATE.active);
    await removeShopDomain(t.db, a, live!.id, NOW);
    const second = await addShopDomain(t.db, b, "shared.salon-take.ca", { max: 5, random });
    expect(second.token).not.toBe(first.token);
    expect(second.state).toBe(DOMAIN_STATE.pendingTxt);
    const stillOld = await checkShopDomain(t.db, second, w.ports());
    expect(stillOld).toMatchObject({ state: DOMAIN_STATE.pendingTxt, lastError: "txt-missing" });
    expect(await shopOfCustomHost(t.db, "shared.salon-take.ca")).toBeNull();
  });

  it("a hostname proven by two shops at once is served by the first; the second fails as taken", async () => {
    const a = await shop();
    const b = await shop();
    const w = world();
    await setCustomDomainOption(t.db, a, true, null, NOW);
    await setCustomDomainOption(t.db, b, true, null, NOW);
    const rowA = await addShopDomain(t.db, a, "race.salon-race.ca", { max: 5, random });
    const rowB = await addShopDomain(t.db, b, "race.salon-race.ca", { max: 5, random });
    w.records.set("_akinaza-verify.race.salon-race.ca", [txtRecordValue(rowA.token), txtRecordValue(rowB.token)]);
    expect((await checkShopDomain(t.db, rowA, w.ports())).state).toBe(DOMAIN_STATE.pendingTls);
    const lost = await checkShopDomain(t.db, rowB, w.ports());
    expect(lost).toMatchObject({ state: DOMAIN_STATE.failed, lastError: "taken", providerId: null });
    expect(w.removed).toContain("ch_race.salon-race.ca");
  });

  it("a lapsed TXT suspends an active domain (released at the edge) and a failed one can be retried", async () => {
    const id = await shop();
    const w = world();
    await setCustomDomainOption(t.db, id, true, null, NOW);
    const row = await addShopDomain(t.db, id, "gone.salon-lapse.ca", { max: 5, random });
    w.records.set("_akinaza-verify.gone.salon-lapse.ca", [txtRecordValue(row.token)]);
    w.setTls("active");
    let cur = await checkShopDomain(t.db, await checkShopDomain(t.db, row, w.ports()), w.ports());
    expect(cur.state).toBe(DOMAIN_STATE.active);
    w.records.clear();
    for (let i = 0; i < limits.lapseAttempts; i += 1) cur = await checkShopDomain(t.db, cur, w.ports());
    expect(cur.state).toBe(DOMAIN_STATE.suspended);
    expect(w.removed).toContain("ch_gone.salon-lapse.ca");
    expect(await shopOfCustomHost(t.db, "gone.salon-lapse.ca")).toBeNull();

    const other = await addShopDomain(t.db, id, "nope.salon-lapse.ca", { max: 5, random });
    let failed = other;
    for (let i = 0; i < limits.maxAttempts; i += 1) failed = await checkShopDomain(t.db, failed, w.ports());
    expect(failed.state).toBe(DOMAIN_STATE.failed);
    await retryShopDomain(t.db, id, failed.id, NOW);
    const [retried] = (await listShopDomains(t.db, id)).filter((d) => d.id === failed.id);
    expect(retried).toMatchObject({ state: DOMAIN_STATE.pendingTxt, attempts: 0 });
  });

  it("the tick works the due domains of shops with the option on, and « check now » is rate limited", async () => {
    const id = await shop();
    const w = world();
    await setCustomDomainOption(t.db, id, true, null, NOW);
    const row = await addShopDomain(t.db, id, "tick.salon-tick.ca", { max: 5, random });
    w.records.set("_akinaza-verify.tick.salon-tick.ca", [txtRecordValue(row.token)]);
    expect(await checkDueDomains(t.db, w.ports(), { everyMs: 60_000, batch: 50 })).toBeGreaterThanOrEqual(1);
    const [after] = await t.db.select().from(shopDomains).where(eq(shopDomains.id, row.id));
    expect(after!.state).toBe(DOMAIN_STATE.pendingTls);
    await expect(checkShopDomainNow(t.db, id, row.id, w.ports(new Date(NOW.getTime() + 1000)), 60_000)).rejects.toMatchObject({ code: DOMAIN_CODE.tooSoon });
    await expect(checkShopDomainNow(t.db, id, row.id, w.ports(new Date(NOW.getTime() + 61_000)), 60_000)).resolves.toBeTruthy();
    // Another shop's domain is simply not found.
    const stranger = await shop();
    await expect(checkShopDomainNow(t.db, stranger, row.id, w.ports(), 0)).rejects.toMatchObject({ code: DOMAIN_CODE.notFound });
    await expect(removeShopDomain(t.db, stranger, row.id, NOW)).rejects.toMatchObject({ code: DOMAIN_CODE.notFound });
    expect((await domainsOverview(t.db)).some((d) => d.id === row.id && d.shopName === "Salon")).toBe(true);
  });
});
