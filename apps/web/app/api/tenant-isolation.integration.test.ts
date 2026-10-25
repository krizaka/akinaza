import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

import { POST as book } from "./me/bookings/route";
import { POST as join } from "./me/join/route";
import { GET as slots } from "./shops/[slug]/slots/route";
import { apiCall, type CallOptions, closeSuite, type Handler, handlersOf, METHODS, openBookableShop, testAccount, testShopPage } from "./test-api";
import { POST as saveReport } from "./walker/bookings/[id]/report/route";
import { POST as invoices } from "./walker/invoices/route";
import { POST as shop } from "./walker/shop/route";
import { POST as invite } from "./walker/team/invitations/route";
import { POST as hook } from "./walker/webhooks/route";
/**
 * Tenant isolation, over the whole walker surface (#247). A member of shop B never reaches shop A's data, and nothing tells them it exists:
 * every refusal is a 404 (never a 403, which would confirm the resource). Two sweeps walk EVERY `app/api/walker/**` route, so a new
 * route cannot ship without a decision:
 *   1. membership - asking for another shop (`?shopId=<A>`) answers 404 on every route that works on "the" shop;
 *   2. resource   - a resource id of shop A, used by the owner of shop B in their own shop, answers 404.
 * On a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=...).
 */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

const routeModules = import.meta.glob<Record<string, unknown>>("./walker/**/route.ts");
const routeSources = import.meta.glob<string>("./walker/**/route.ts", { query: "?raw", import: "default", eager: true });

/** The route files of the walker, by their address (`/api/walker/zones/[id]`). */
const addressOf = (file: string) => `/api/walker${file.slice("./walker".length, -"/route.ts".length)}`;
const ROUTES = Object.keys(routeModules).map((file) => ({ file, address: addressOf(file), source: routeSources[file]! })).sort((a, b) => a.address.localeCompare(b.address));

/** What a route does with the shop: through a shop guard (membership sweep), or about the session's own items (collections, tags, shops). */
const SHOP_GUARD = /require(Shop|Owner|ShopClient)\b|visitRoute|teamRoute/;
const SESSION_OWNED = new Set(["/api/walker/shop-collections", "/api/walker/shop-collections/[id]", "/api/walker/shop-tags", "/api/walker/shop-tags/[id]", "/api/walker/shops", "/api/walker/shops/[id]", "/api/walker/shops/[id]/default", "/api/walker/shop"]);

/** An address with its dynamic segments filled (`values` for the named ones, else a fresh UUID or a day) - and the same as route params. */
const at = (address: string, values: Record<string, string> = {}) => {
  const params: Record<string, string> = {};
  const path = address.replace(/\[(\w+)\]/g, (_m, name: string) => (params[name] = values[name] ?? (name === "day" ? "2026-12-24" : randomUUID())));
  return { path, params };
};

describe.runIf(enabled)("tenant isolation over the walker surface", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const tokens = {} as Record<"a" | "b" | "client", string>;
  const ids = {} as { shopA: string; shopB: string; zone: string; service: string; hour: string; client: string; appointment: string; booking: string; invoice: string; webhook: string; invitation: string; staff: string; collection: string; tag: string };

  const call = (handler: Handler, method: string, path: string, opts: CallOptions = {}) => apiCall(handler, method, path, opts);
  const account = (label: string) => testAccount(label, stamp);
  const page = testShopPage;

  beforeAll(async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    await migrate();
    const [a, b, c] = [await account("owner-a"), await account("owner-b"), await account("client")];
    Object.assign(tokens, { a: a.token, b: b.token, client: c.token });
    const opened = await openBookableShop(a.token, "Atelier A", `a-${stamp}`);
    Object.assign(ids, { shopA: opened.shopId, zone: opened.zone, service: opened.service, hour: opened.hour });
    ids.shopB = (await call(shop as Handler, "POST", "/api/walker/shop", { token: b.token, json: page("Atelier B", `b-${stamp}`) })).body.shopId;
    const asA = { token: a.token };
    ids.client = (await call(join as Handler, "POST", "/api/me/join", { token: c.token, json: { shopId: ids.shopA, fullName: "Camille Tremblay", phone: "514-555-0100", language: "fr", consentService: true } })).body.clientId;
    const offered = await call(slots as Handler, "GET", `/api/shops/a-${stamp}/slots?serviceId=${ids.service}&zoneId=${ids.zone}`, { params: { slug: `a-${stamp}` } });
    const booked = await call(book as Handler, "POST", "/api/me/bookings", { token: c.token, json: { clientId: ids.client, serviceId: ids.service, zoneId: ids.zone, dependantIds: [], startsAt: offered.body.slots[0].startsAt } });
    ids.appointment = booked.body.appointmentId;
    ids.booking = booked.body.bookingIds?.[0] ?? randomUUID();
    const note = new FormData();
    note.set("note", "Belle promenade");
    await call(saveReport as Handler, "POST", `/api/walker/bookings/${ids.booking}/report`, { ...asA, params: { id: ids.booking }, form: note });
    ids.invoice = (await call(invoices as Handler, "POST", "/api/walker/invoices", { ...asA, json: { clientId: ids.client, language: "fr", issuedOn: "2026-10-23", lines: [{ description: "Coupe", unitPriceCents: 3000, quantity: 1 }] } })).body.id;
    ids.webhook = (await call(hook as Handler, "POST", "/api/walker/webhooks", { ...asA, json: { url: "https://hooks.example.com/a", events: ["booking.created"] } })).body.endpoint.id;
    ids.invitation = (await call(invite as Handler, "POST", "/api/walker/team/invitations", { ...asA, json: { email: `invitee-${stamp}@example.com`, role: "staff" } })).body.invitation?.id ?? randomUUID();
    [ids.staff] = (await query<{ id: string }>("SELECT id FROM staff WHERE shop_id = $1 LIMIT 1", [ids.shopA])).map((r) => r.id);
    ids.collection = (await query<{ id: string }>("SELECT id FROM collections WHERE owner_id = $1 LIMIT 1", [a.id]))[0]?.id ?? randomUUID();
    ids.tag = (await query<{ id: string }>("SELECT id FROM tags WHERE owner_id = $1 LIMIT 1", [a.id]))[0]?.id ?? randomUUID();
  });
  beforeEach(() => resetRateLimits());
  afterAll(() => closeSuite(stamp));

  const exportsOf = (file: string) => handlersOf(routeModules[file]!);

  it("finds the whole walker surface (a guard against an empty sweep)", () => {
    expect(ROUTES.length).toBeGreaterThan(35);
  });

  it("answers 401 to every walker route without a session", async () => {
    for (const route of ROUTES) {
      for (const { method, handler } of await exportsOf(route.file)) {
        const { path, params } = at(route.address);
        const res = await call(handler, method, path, { params, json: method === "GET" || method === "DELETE" ? undefined : {} });
        expect(res.status, `${method} ${route.address}`).toBe(401);
      }
    }
  });

  it("answers 404 on every route that works on a shop when the caller is not a member of the shop asked for (?shopId)", async () => {
    let checked = 0;
    for (const route of ROUTES.filter((r) => SHOP_GUARD.test(r.source) && !SESSION_OWNED.has(r.address))) {
      for (const { method, handler } of await exportsOf(route.file)) {
        const { path, params } = at(route.address);
        const res = await call(handler, method, `${path}?shopId=${ids.shopA}`, { token: tokens.b, params, json: method === "GET" || method === "DELETE" ? undefined : {} });
        expect(res.status, `${method} ${route.address} as another shop's member`).toBe(404);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("every walker route is either guarded by a shop check or declared as the session's own", () => {
    const unguarded = ROUTES.filter((r) => !SHOP_GUARD.test(r.source) && !SESSION_OWNED.has(r.address)).map((r) => r.address);
    expect(unguarded, "a route with no shop guard must be added to SESSION_OWNED with a reason, or use requireShop").toEqual([]);
  });

  /** Shop A's resources, used by the owner of shop B in their own shop: nothing tells B they exist. */
  const RESOURCES: { address: string; method: (typeof METHODS)[number]; params: () => Record<string, string>; json?: () => unknown; form?: () => FormData; idempotent?: boolean; refused?: number; intact?: () => Promise<void> }[] = [
    { address: "/api/walker/bookings/[id]/report", method: "POST", params: () => ({ id: ids.booking }), form: () => { const f = new FormData(); f.set("note", "x"); return f; } },
    // 409 AK_NO_REPORT: the lookup is scoped to the caller's shop, so another shop's report is "no report" - the answer of an unknown id.
    { address: "/api/walker/bookings/[id]/report/send", method: "POST", params: () => ({ id: ids.booking }), refused: 409 },
    { address: "/api/walker/clients/[id]/access-notes", method: "GET", params: () => ({ id: ids.client }) },
    { address: "/api/walker/clients/[id]/notes", method: "POST", params: () => ({ id: ids.client }), json: () => ({ body: "x" }), intact: async () => expect(await query("SELECT 1 FROM client_notes WHERE client_id = $1", [ids.client])).toHaveLength(0) },
    { address: "/api/walker/hours/[id]", method: "DELETE", params: () => ({ id: ids.hour }), idempotent: true, intact: async () => expect(await query("SELECT 1 FROM schedules WHERE id = $1", [ids.hour])).toHaveLength(1) },
    { address: "/api/walker/invoices/[id]/payments", method: "POST", params: () => ({ id: ids.invoice }), json: () => ({ amountCents: 100, method: "cash", receivedOn: "2026-10-23" }) },
    { address: "/api/walker/invoices/[id]/replace", method: "POST", params: () => ({ id: ids.invoice }), json: () => ({ language: "fr", issuedOn: "2026-10-23", lines: [{ description: "x", unitPriceCents: 100, quantity: 1 }] }) },
    { address: "/api/walker/invoices/[id]/send", method: "POST", params: () => ({ id: ids.invoice }), json: () => ({ toEmail: "x@example.com" }) },
    // 400 INVITE_INVALID: the package's one answer for an invitation that is not the caller's shop's (foreign or unknown alike).
    { address: "/api/walker/team/invitations/[id]", method: "DELETE", params: () => ({ id: ids.invitation }), refused: 400 },
    { address: "/api/walker/team/members/[accountId]", method: "DELETE", params: () => ({ accountId: ids.staff }) },
    { address: "/api/walker/team/members/[accountId]", method: "PATCH", params: () => ({ accountId: ids.staff }), json: () => ({ role: "manager" }) },
    { address: "/api/walker/visits/[id]/check-in", method: "POST", params: () => ({ id: ids.appointment }) },
    { address: "/api/walker/visits/[id]/check-out", method: "POST", params: () => ({ id: ids.appointment }) },
    { address: "/api/walker/webhooks/[id]", method: "PATCH", params: () => ({ id: ids.webhook }), json: () => ({ active: false }) },
    { address: "/api/walker/webhooks/[id]", method: "DELETE", params: () => ({ id: ids.webhook }) },
    { address: "/api/walker/webhooks/[id]/rotate", method: "POST", params: () => ({ id: ids.webhook }) },
    { address: "/api/walker/webhooks/[id]/deliveries", method: "GET", params: () => ({ id: ids.webhook }) },
    { address: "/api/walker/zones/[id]", method: "DELETE", params: () => ({ id: ids.zone }), idempotent: true, intact: async () => expect(await query("SELECT 1 FROM shop_zones WHERE id = $1 AND active", [ids.zone])).toHaveLength(1) },
    { address: "/api/walker/shops/[id]", method: "PATCH", params: () => ({ id: ids.shopA }), json: () => ({ name: "Pris" }) },
    { address: "/api/walker/shops/[id]/default", method: "POST", params: () => ({ id: ids.shopA }) },
    { address: "/api/walker/shop-collections/[id]", method: "PATCH", params: () => ({ id: ids.collection }), json: () => ({ name: "Pris" }) },
    { address: "/api/walker/shop-collections/[id]", method: "DELETE", params: () => ({ id: ids.collection }) },
    { address: "/api/walker/shop-tags/[id]", method: "PATCH", params: () => ({ id: ids.tag }), json: () => ({ name: "Pris" }) },
    { address: "/api/walker/shop-tags/[id]", method: "DELETE", params: () => ({ id: ids.tag }) },
  ];
  /** Dynamic segments that are not another shop's resource: a calendar day names a day of the caller's own shop. */
  const OWN_DAY = new Set(["/api/walker/days-off/[day]"]);

  it("declares every walker route with a resource id (a new one must be added to RESOURCES)", () => {
    const declared = new Set(RESOURCES.map((r) => r.address));
    const missing = ROUTES.filter((r) => /\[\w+\]/.test(r.address) && !declared.has(r.address) && !OWN_DAY.has(r.address)).map((r) => r.address);
    expect(missing).toEqual([]);
    const stale = [...declared].filter((address) => !ROUTES.some((r) => r.address === address));
    expect(stale).toEqual([]);
  });

  it.each(RESOURCES.map((r) => [`${r.method} ${r.address}`, r] as const))("%s: shop A's resource is a 404 to shop B's owner", async (_name, r) => {
    const file = `./walker${r.address.slice("/api/walker".length)}/route.ts`;
    const handler = (await routeModules[file]!())[r.method] as Handler;
    const { path, params } = at(r.address, r.params());
    const foreign = await call(handler, r.method, path, { token: tokens.b, params, form: r.form?.(), json: r.json?.() });
    const unknown = at(r.address, Object.fromEntries(Object.keys(params).map((k) => [k, randomUUID()])));
    const absent = await call(handler, r.method, unknown.path, { token: tokens.b, params: unknown.params, form: r.form?.(), json: r.json?.() });
    // Nothing tells B the resource exists: the answer is the one an id that exists nowhere gets ...
    expect(foreign.status, "a foreign id must answer like an unknown one").toBe(absent.status);
    expect(foreign.body?.code).toEqual(absent.body?.code);
    // ... which is a 404, except the two idempotent deletes (hours, zones), a no-op that leaves the data alone.
    if (r.idempotent) expect(foreign.status).toBe(200);
    else expect(foreign.status, JSON.stringify(foreign.body)).toBe(r.refused ?? 404);
    await r.intact?.();
  });

  it("a translation of shop A's text, written by shop B's owner, is a 404 (#258)", async () => {
    const handler = (await routeModules["./walker/translations/text/route.ts"]!()).PUT as Handler;
    for (const key of [`service:${ids.service}:name`, `shop:${ids.shopA}:tagline`]) {
      const res = await call(handler, "PUT", "/api/walker/translations/text", { token: tokens.b, json: { locale: "en", key, text: "Stolen" } });
      expect(res.status, key).toBe(404);
    }
    expect(await query("SELECT 1 FROM shop_translations WHERE shop_id = $1", [ids.shopA])).toHaveLength(0);
  });

  it("the owner of shop A still reaches their own (the sweeps would pass on a broken fixture otherwise)", async () => {
    const handler = (await routeModules["./walker/webhooks/[id]/deliveries/route.ts"]!()).GET as Handler;
    const { path, params } = at("/api/walker/webhooks/[id]/deliveries", { id: ids.webhook });
    const own = await call(handler, "GET", path, { token: tokens.a, params });
    expect(own.status).toBe(200);
  });
});
