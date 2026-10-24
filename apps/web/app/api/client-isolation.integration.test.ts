import { randomUUID } from "node:crypto";

import { clientFilesOf, invoiceForClientAccount } from "@akinaza/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db, migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

import { GET as calendar } from "./me/bookings/[id]/calendar/route";
import { POST as book } from "./me/bookings/route";
import { POST as addDependant } from "./me/dependants/route";
import { GET as exportData } from "./me/export/route";
import { POST as join } from "./me/join/route";
import { POST as saveRequest } from "./me/requests/route";
import { GET as slots } from "./shops/[slug]/slots/route";
import { apiCall, type Handler, openBookableShop, testAccount } from "./test-api";
import { POST as saveReport } from "./walker/bookings/[id]/report/route";
import { POST as invoices } from "./walker/invoices/route";

/**
 * Client isolation (K7): a client sees only their own bookings, invoices and files, at every shop they deal with — and nothing tells
 * another client that someone else's exist. Two clients of the SAME shop (the closest neighbours there are): every `app/api/me/**`
 * route that reaches a client's file or one of its records answers Bob a 404 for Alice's ids (never a 403, which would confirm them),
 * the client space reads only the account's own files, and the account's invoice page finds only the account's invoices. A sweep
 * over the route files makes a new client route declare itself here. On a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=...).
 */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const routeModules = import.meta.glob<Record<string, unknown>>("./me/**/route.ts");
const routeSources = import.meta.glob<string>("./me/**/route.ts", { query: "?raw", import: "default", eager: true });
const addressOf = (file: string) => `/api/me${file.slice("./me".length, -"/route.ts".length)}`;
const ROUTES = Object.keys(routeModules).map((file) => ({ file, address: addressOf(file), source: routeSources[file]! }));

/** A route reaches a client's records when it goes through the client guard or names a record in its path. */
const reachesRecords = (route: { address: string; source: string }) => /requireOwnClient\b/.test(route.source) || /\[\w+\]/.test(route.address);
/** The account's own records, not a client file's, and where their isolation is proven. */
const ACCOUNT_OWNED: Record<string, string> = {
  "/api/me/api-keys/[id]": "an account's own keys: another account's key is a 404 in api-keys.integration.test.ts",
  "/api/me/api-keys/[id]/rotate": "an account's own keys: another account's key is a 404 in api-keys.integration.test.ts",
};

type Ids = { alice: string; bob: string; booking: string; report: string; request: string; dog: string; service: string; zone: string; startsAt: string; bobEmail: string };
type Ask = { path: string; params?: Record<string, string>; json?: unknown; form?: FormData };
/** Every client route, as Bob asking for Alice's records. `refused` is a status that answers before any lookup, for a foreign and an unknown id alike. */
const RESOURCES: { method: (typeof METHODS)[number]; address: string; ask: (ids: Ids) => Ask; refused?: number; why?: string }[] = [
  { method: "GET", address: "/api/me/export", ask: (i) => ({ path: `/api/me/export?clientId=${i.alice}` }) },
  { method: "POST", address: "/api/me/erase", ask: (i) => ({ path: "/api/me/erase", json: { clientId: i.alice, confirmEmail: i.bobEmail } }) },
  { method: "POST", address: "/api/me/access-notes", ask: (i) => ({ path: "/api/me/access-notes", json: { clientId: i.alice, notes: "Code 1234" } }) },
  { method: "POST", address: "/api/me/dependants", ask: (i) => ({ path: "/api/me/dependants", json: { clientId: i.alice, kind: "dog", name: "Intrus" } }) },
  { method: "POST", address: "/api/me/bookings", ask: (i) => ({ path: "/api/me/bookings", json: { clientId: i.alice, serviceId: i.service, zoneId: i.zone, dependantIds: [], startsAt: i.startsAt } }) },
  { method: "POST", address: "/api/me/bookings/[id]/cancel", ask: (i) => ({ path: `/api/me/bookings/${i.booking}/cancel`, params: { id: i.booking }, json: { clientId: i.alice } }) },
  { method: "GET", address: "/api/me/bookings/[id]/calendar", ask: (i) => ({ path: `/api/me/bookings/${i.booking}/calendar`, params: { id: i.booking } }) },
  { method: "GET", address: "/api/me/reports/[id]/photo", ask: (i) => ({ path: `/api/me/reports/${i.report}/photo?clientId=${i.alice}`, params: { id: i.report } }) },
  { method: "GET", address: "/api/me/requests", ask: (i) => ({ path: `/api/me/requests?clientId=${i.alice}` }) },
  { method: "POST", address: "/api/me/requests", ask: (i) => ({ path: "/api/me/requests", json: { clientId: i.alice, serviceId: i.service, title: "Comme Alice" } }) },
  { method: "DELETE", address: "/api/me/requests/[id]", ask: (i) => ({ path: `/api/me/requests/${i.request}`, params: { id: i.request }, json: { clientId: i.alice } }) },
  { method: "DELETE", address: "/api/me/requests/[id]/files/[fileId]", ask: (i) => ({ path: `/api/me/requests/${i.request}/files/${i.request}`, params: { id: i.request, fileId: i.request }, json: { clientId: i.alice } }) },
  {
    method: "POST",
    address: "/api/me/requests/[id]/files",
    ask: (i) => {
      const form = new FormData();
      form.set("clientId", i.alice);
      return { path: `/api/me/requests/${i.request}/files`, params: { id: i.request }, form };
    },
    refused: 503,
    why: "without a media storage (the tests have none) the upload answers 503 before it reads any id",
  },
];

describe.runIf(enabled)("a client reaches only their own records (K7)", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const ids = {} as Ids & { invoice: string; aliceAccount: string; bobAccount: string };
  const tokens = {} as Record<"alice" | "bob", string>;

  const call = (handler: Handler, method: string, { path, ...opts }: Ask & { token?: string }) => apiCall(handler, method, path, opts);
  const account = (label: string) => testAccount(label, stamp);

  beforeAll(async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    await migrate();
    const [owner, alice, bob] = [await account("ci-owner"), await account("ci-alice"), await account("ci-bob")];
    Object.assign(tokens, { alice: alice.token, bob: bob.token });
    Object.assign(ids, { aliceAccount: alice.id, bobAccount: bob.id, bobEmail: bob.email });
    const asOwner = { token: owner.token };
    const { shopId, zone, service } = await openBookableShop(owner.token, "Atelier Isolé", `iso-${stamp}`);
    Object.assign(ids, { zone, service });
    const joinAs = async (token: string, fullName: string) => (await call(join as Handler, "POST", { token, path: "/api/me/join", json: { shopId, fullName, phone: "514-555-0100", language: "fr", consentService: true } })).body.clientId as string;
    ids.alice = await joinAs(alice.token, "Alice Gagnon");
    ids.bob = await joinAs(bob.token, "Bob Tremblay");
    const offered = (await call(slots as Handler, "GET", { path: `/api/shops/iso-${stamp}/slots?serviceId=${ids.service}&zoneId=${ids.zone}`, params: { slug: `iso-${stamp}` } })).body.slots;
    ids.startsAt = offered.at(-1).startsAt; // far from the one Alice books: a refusal can only be about whose dog it is
    ids.dog = (await call(addDependant as Handler, "POST", { token: alice.token, path: "/api/me/dependants", json: { clientId: ids.alice, kind: "dog", name: "Biscuit" } })).body.id;
    const booked = await call(book as Handler, "POST", { token: alice.token, path: "/api/me/bookings", json: { clientId: ids.alice, serviceId: ids.service, zoneId: ids.zone, dependantIds: [], startsAt: offered[0].startsAt } });
    ids.booking = booked.body.bookingIds[0];
    const note = new FormData();
    note.set("note", "Belle promenade");
    await call(saveReport as Handler, "POST", { ...asOwner, path: `/api/walker/bookings/${ids.booking}/report`, params: { id: ids.booking }, form: note });
    ids.report = (await query<{ id: string }>("SELECT id FROM visit_reports WHERE booking_id = $1", [ids.booking]))[0]?.id ?? randomUUID();
    ids.invoice = (await call(invoices as Handler, "POST", { ...asOwner, path: "/api/walker/invoices", json: { clientId: ids.alice, language: "fr", issuedOn: "2026-10-23", lines: [{ description: "Promenade", unitPriceCents: 3000, quantity: 1 }] } })).body.id;
    ids.request = (await call(saveRequest as Handler, "POST", { token: alice.token, path: "/api/me/requests", json: { clientId: ids.alice, serviceId: ids.service, title: "Comme d'habitude" } })).body.id;
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    vi.unstubAllEnvs();
    await pool().end();
  });

  const exportsOf = async (file: string) => {
    const mod = await routeModules[file]!();
    return METHODS.filter((m) => typeof mod[m] === "function").map((method) => ({ method, handler: mod[method] as Handler }));
  };

  it("builds a fixture where Alice has every kind of record (the sweep would pass on an empty one otherwise)", () => {
    for (const key of ["alice", "bob", "booking", "dog", "invoice", "request"] as const) expect(ids[key], key).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids.alice).not.toBe(ids.bob);
  });

  it("declares every client route that reaches a record (a new one must be added to RESOURCES)", async () => {
    const declared = new Set(RESOURCES.map((r) => `${r.method} ${r.address}`));
    const missing: string[] = [];
    for (const route of ROUTES.filter(reachesRecords)) {
      if (ACCOUNT_OWNED[route.address]) continue;
      for (const { method } of await exportsOf(route.file)) if (!declared.has(`${method} ${route.address}`)) missing.push(`${method} ${route.address}`);
    }
    expect(missing).toEqual([]);
  });

  it.each(RESOURCES.map((r) => [`${r.method} ${r.address}`, r] as const))("%s: Alice's record is a 404 to Bob", async (_name, r) => {
    const route = ROUTES.find((x) => x.address === r.address)!;
    const handler = (await exportsOf(route.file)).find((e) => e.method === r.method)!.handler;
    const res = await call(handler, r.method, { ...r.ask(ids), token: tokens.bob });
    expect(res.status, `${JSON.stringify(res.body)}${r.why ? ` (${r.why})` : ""}`).toBe(r.refused ?? 404);
  });

  it("answers Bob a 404 for Alice's records under his own file too: her booking, her report, her request, her dog", async () => {
    const asBob = (ask: Ask) => ({ ...ask, token: tokens.bob });
    const { POST: cancel } = await import("./me/bookings/[id]/cancel/route");
    const { GET: photo } = await import("./me/reports/[id]/photo/route");
    const { DELETE: dropRequest } = await import("./me/requests/[id]/route");
    expect((await call(cancel as Handler, "POST", asBob({ path: `/api/me/bookings/${ids.booking}/cancel`, params: { id: ids.booking }, json: { clientId: ids.bob } }))).status).toBe(404);
    expect((await call(photo as Handler, "GET", asBob({ path: `/api/me/reports/${ids.report}/photo?clientId=${ids.bob}`, params: { id: ids.report } }))).status).toBe(404);
    expect((await call(dropRequest as Handler, "DELETE", asBob({ path: `/api/me/requests/${ids.request}`, params: { id: ids.request }, json: { clientId: ids.bob } }))).status).toBe(404);
    // A booking for a dog of another file is refused as an unknown dog: a 404, never a 403 that would confirm it exists.
    const res = await call(book as Handler, "POST", asBob({ path: "/api/me/bookings", json: { clientId: ids.bob, serviceId: ids.service, zoneId: ids.zone, dependantIds: [ids.dog], startsAt: ids.startsAt } }));
    expect(res.status, JSON.stringify(res.body)).toBe(404);
  });

  it("the client space reads only the account's own files, and the invoice page only the account's invoices", async () => {
    expect((await clientFilesOf(db(), ids.bobAccount)).map((f) => f.id)).toEqual([ids.bob]);
    expect((await clientFilesOf(db(), ids.aliceAccount)).map((f) => f.id)).toEqual([ids.alice]);
    expect(await invoiceForClientAccount(db(), ids.bobAccount, ids.invoice)).toBeNull();
    expect(await invoiceForClientAccount(db(), ids.aliceAccount, ids.invoice)).not.toBeNull();
  });

  it("Alice still reaches her own (the 404s are about whose records, not a broken fixture)", async () => {
    const asAlice = (ask: Ask) => ({ ...ask, token: tokens.alice });
    expect((await call(exportData as Handler, "GET", asAlice({ path: `/api/me/export?clientId=${ids.alice}` }))).status).toBe(200);
    expect((await call(calendar as Handler, "GET", asAlice({ path: `/api/me/bookings/${ids.booking}/calendar`, params: { id: ids.booking } }))).status).toBe(200);
  });
});
