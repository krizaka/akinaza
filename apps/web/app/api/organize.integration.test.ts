import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrate, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

import { GET as getConfig, PUT as putConfig } from "./admin/organize/[kind]/config/route";
import { apiCall, closeSuite, openBookableShop, testAccount } from "./test-api";
import { POST as applyClientTags } from "./walker/clients/tags/apply/route";
import { GET as listClientTags, POST as createClientTag } from "./walker/clients/tags/route";
import { GET as listClientViews, POST as createClientView } from "./walker/clients/views/route";
import { POST as applyInvoiceTags } from "./walker/invoices/tags/apply/route";
import { GET as listInvoiceViews } from "./walker/invoices/views/route";

/** The shop's tags, saved views and bulk tagging over HTTP (akinaza#337), on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
const routeSources = import.meta.glob<string>("./walker/**/route.ts", { query: "?raw", import: "default", eager: true });

describe.runIf(enabled)("the shop's tags, views and bulk tagging over HTTP", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  let a: Awaited<ReturnType<typeof testAccount>>;
  let b: Awaited<ReturnType<typeof testAccount>>;
  let shopA: string;
  const clientsA: string[] = [];
  const call = (h: unknown, m: string, path: string, token: string, json?: unknown) => apiCall(h, m, path, { token, json });

  beforeAll(async () => {
    await migrate();
    [a, b] = [await testAccount("tags-a", stamp), await testAccount("tags-b", stamp)];
    shopA = (await openBookableShop(a.token, "Atelier Tags A", `tags-a-${stamp}`)).shopId;
    await openBookableShop(b.token, "Atelier Tags B", `tags-b-${stamp}`);
    for (let i = 0; i < 3; i++) clientsA.push((await query<{ id: string }>("INSERT INTO clients (shop_id, full_name) VALUES ($1, $2) RETURNING id", [shopA, `Client ${i}`]))[0]!.id);
  });
  beforeEach(() => resetRateLimits());
  afterAll(() => closeSuite(stamp));

  it("the first visit gives the shop its default tag set, with how many clients wear each", async () => {
    const res = await call(listClientTags, "GET", "/api/walker/clients/tags", a.token);
    expect(res.status).toBe(200);
    expect(res.body.tags.length).toBeGreaterThanOrEqual(3);
    expect(res.body.counts).toEqual({});
    expect(await query("SELECT 1 FROM shops WHERE id = $1 AND organized_at IS NOT NULL", [shopA])).toHaveLength(1);
  });

  it("creates a tag, tags three clients in one call, and counts them; one audit line per client", async () => {
    const tag = (await call(createClientTag, "POST", "/api/walker/clients/tags", a.token, { name: "Quartier Est", marker: "blue" })).body.tag;
    expect((await call(applyClientTags, "POST", "/api/walker/clients/tags/apply", a.token, { ids: clientsA, add: [tag.id] })).body).toEqual({ changed: 3 });
    expect((await call(listClientTags, "GET", "/api/walker/clients/tags", a.token)).body.counts).toEqual({ [tag.id]: 3 });
    expect(await query("SELECT 1 FROM audit_log WHERE action = 'organize.tags_changed' AND detail->>'shopId' = $1", [shopA])).toHaveLength(3);
    expect((await call(applyClientTags, "POST", "/api/walker/clients/tags/apply", a.token, { ids: clientsA.slice(0, 1), remove: [tag.id] })).body).toEqual({ changed: 1 });
  });

  it("another shop's client in the selection is a 404 and nothing is tagged", async () => {
    const tag = (await call(createClientTag, "POST", "/api/walker/clients/tags", b.token, { name: "À moi", marker: "green" })).body.tag;
    const res = await call(applyClientTags, "POST", "/api/walker/clients/tags/apply", b.token, { ids: clientsA, add: [tag.id] });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(await query("SELECT 1 FROM organize.client_tag WHERE tag_id = $1", [tag.id])).toHaveLength(0);
  });

  it("refuses a selection of more than 200", async () => {
    const tag = (await call(listClientTags, "GET", "/api/walker/clients/tags", a.token)).body.tags[0];
    const res = await call(applyClientTags, "POST", "/api/walker/clients/tags/apply", a.token, { ids: Array.from({ length: 201 }, () => randomUUID()), add: [tag.id] });
    expect(res.body.code).toBe("TOO_MANY");
  });

  it("saves a view whose filters are the address's, lists it, and refuses an unknown state", async () => {
    const saved = await call(createClientView, "POST", "/api/walker/clients/views", a.token, { name: "Est", filters: { q: "Client" } });
    expect(saved.status).toBe(201);
    const list = (await call(listClientViews, "GET", "/api/walker/clients/views", a.token)).body;
    expect(list.mine.map((v: { name: string }) => v.name)).toEqual(["Est"]);
    expect((await call(listInvoiceViews, "GET", "/api/walker/invoices/views", a.token)).body.system.map((v: { key: string }) => v.key)).toEqual(["to_collect", "overdue", "paid"]);
    const bad = await call(createClientView, "POST", "/api/walker/clients/views", a.token, { name: "Faux", filters: { status: ["paid"] } });
    expect(bad.status).toBe(400);
  });

  it("an invoice's state cannot be moved by hand: no route moves a status, and tagging an unknown invoice is a 404", async () => {
    for (const [file, source] of Object.entries(routeSources)) expect(source, file).not.toMatch(/status\.move/);
    const none = await call(applyInvoiceTags, "POST", "/api/walker/invoices/tags/apply", a.token, { ids: [randomUUID()], add: [randomUUID()] });
    expect(none.status).toBe(404);
  });

  it("the administrator edits the default tag set (versioned, audited); an owner cannot", async () => {
    const admin = await testAccount("tags-admin", stamp);
    await query("UPDATE accounts SET role = 'ADMIN' WHERE id = $1", [admin.id]);
    const as = (token: string, json?: unknown, method = "GET") => apiCall(method === "GET" ? getConfig : putConfig, method, "/api/admin/organize/client/config", { token, json, params: { kind: "client" } });
    expect((await as(a.token)).status).toBe(403);
    const { stored } = (await as(admin.token)).body;
    const config = { ...stored.config, tags: { ...stored.config.tags, max: 40 } };
    expect((await as(admin.token, { config, version: stored.version }, "PUT")).body.stored.version).toBe(stored.version + 1);
    expect((await as(admin.token, { config, version: stored.version }, "PUT")).body.code).toBe("CONFLICT");
    expect((await apiCall(getConfig, "GET", "/api/admin/organize/nope/config", { token: admin.token, params: { kind: "nope" } })).status).toBe(404);
  });
});
