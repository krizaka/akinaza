import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";
import { resetAppSettings } from "@/lib/settings";

import { DELETE as resetSetting, PUT as setSetting } from "./admin/settings/[key]/route";
import { GET as settingsHistory } from "./admin/settings/history/route";
import { GET as adminSettings } from "./admin/settings/route";
import { POST as rotate } from "./me/api-keys/[id]/rotate/route";
import { DELETE as revoke } from "./me/api-keys/[id]/route";
import { GET as listKeys,POST as create } from "./me/api-keys/route";
import { GET as bookings } from "./v1/bookings/route";
import { GET as clients } from "./v1/clients/route";
import { GET as invoices } from "./v1/invoices/route";
import { GET as reports } from "./v1/reports/route";
import { POST as saveShop } from "./walker/shop/route";

/** The API keys of an owner over HTTP, on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { cookie?: string; bearer?: string; json?: unknown; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = `${SESSION_COOKIE}=${opts.cookie}`;
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }), { params: Promise.resolve((opts.params ?? {}) as never) });
  return { status: res.status, body: (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : null };
}

describe.runIf(enabled)("API keys over HTTP", () => {
  // Unique across test files run in parallel: two files starting in the same millisecond collided on accounts_email_unique.
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const sessions: Record<string, string> = {};
  const make = async (label: string) => {
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [`${label}-${stamp}@akinaza.test`]);
    sessions[label] = (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token;
  };
  beforeAll(async () => {
    await migrate();
    for (const label of ["owner", "other", "noshop", "admin"]) await make(label);
    await query("UPDATE accounts SET role = 'ADMIN' WHERE email = $1", [`admin-${stamp}@akinaza.test`]);
    await call(saveShop, "POST", "/api/walker/shop", { cookie: sessions.owner, json: { name: "Atelier", legalName: "Atelier", address: "1 rue Test", slug: `atelier-${stamp}`, ownerName: "Éric" } });
    await call(saveShop, "POST", "/api/walker/shop", { cookie: sessions.other, json: { name: "Autre", legalName: "Autre", address: "2 rue Test", slug: `autre-${stamp}`, ownerName: "Zoé" } });
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  it("creates a key (shown once), reads with it within its scopes, rotates and revokes it", async () => {
    expect((await call(create, "POST", "/api/me/api-keys", { cookie: sessions.noshop, json: { name: "x", scopes: ["clients:read"], expiresInDays: 30 } })).status).toBe(403);
    const made = await call(create, "POST", "/api/me/api-keys", { cookie: sessions.owner, json: { name: "Tableau de bord", scopes: ["clients:read", "bookings:read"], expiresInDays: 30 } });
    expect(made.status).toBe(201);
    const key = made.body.key as string;
    expect(key).toMatch(/^akz_[0-9a-f]{12}_/);
    const listed = (await call(listKeys, "GET", "/api/me/api-keys", { cookie: sessions.owner })).body;
    expect(JSON.stringify(listed)).not.toContain(key);
    expect(listed.keys).toHaveLength(1);
    // reads inside the scopes, refuses outside, refuses no key and a wrong one
    expect((await call(clients, "GET", "/api/v1/clients", { bearer: key })).body.clients).toEqual([]);
    expect((await call(bookings, "GET", "/api/v1/bookings?day=2026-10-20", { bearer: key })).body).toMatchObject({ day: "2026-10-20", bookings: [] });
    expect((await call(invoices, "GET", "/api/v1/invoices", { bearer: key })).status).toBe(403);
    expect((await call(clients, "GET", "/api/v1/clients")).status).toBe(401);
    expect((await call(clients, "GET", "/api/v1/clients", { bearer: `${key}x` })).status).toBe(401);
    expect((await call(bookings, "GET", "/api/v1/bookings?day=tomorrow", { bearer: key })).status).toBe(400);
    // another owner's shop is never reachable with this key
    const otherShop = (await query<{ id: string }>("SELECT s.id FROM shops s JOIN accounts a ON a.id = s.owner_id WHERE a.email = $1", [`other-${stamp}@akinaza.test`]))[0]!.id;
    expect((await call(clients, "GET", `/api/v1/clients?shopId=${otherShop}`, { bearer: key })).status).toBe(404);
    // rotation: the new key works, the old one lives through its grace period, then revoking stops one at once
    const rotated = await call(rotate, "POST", "/x", { cookie: sessions.owner, params: { id: made.body.apiKey.id } });
    expect(rotated.status).toBe(201);
    expect((await call(clients, "GET", "/api/v1/clients", { bearer: rotated.body.key })).status).toBe(200);
    expect((await call(revoke, "DELETE", "/x", { cookie: sessions.owner, params: { id: rotated.body.apiKey.id } })).status).toBe(200);
    expect((await call(clients, "GET", "/api/v1/clients", { bearer: rotated.body.key })).status).toBe(401);
    // another owner cannot revoke it
    expect((await call(revoke, "DELETE", "/x", { cookie: sessions.other, json: undefined, params: { id: made.body.apiKey.id } })).status).toBe(404);
  });

  it("the invoices and reports scopes read the owner's books; a period is checked", async () => {
    const made = await call(create, "POST", "/api/me/api-keys", { cookie: sessions.owner, json: { name: "Comptable", scopes: ["invoices:read", "reports:read"], expiresInDays: 30 } });
    const key = made.body.key as string;
    expect((await call(invoices, "GET", "/api/v1/invoices", { bearer: key })).body.invoices).toEqual([]);
    expect((await call(reports, "GET", "/api/v1/reports?from=2026-07-01&to=2026-09-30", { bearer: key })).body).toMatchObject({ from: "2026-07-01", to: "2026-09-30" });
    expect((await call(reports, "GET", "/api/v1/reports?from=2026-09-30&to=2026-07-01", { bearer: key })).status).toBe(400);
  });

  it("holds as many keys as the plan allows", async () => {
    const [{ n }] = await query<{ n: number }>("SELECT count(*)::int AS n FROM api_keys k JOIN accounts a ON a.id = k.owner_id WHERE a.email = $1 AND k.revoked_at IS NULL", [`owner-${stamp}@akinaza.test`]);
    let last = 0;
    for (let i = n; i <= 2; i++) last = (await call(create, "POST", "/api/me/api-keys", { cookie: sessions.owner, json: { name: `k${i}`, scopes: ["clients:read"], expiresInDays: 7 } })).status;
    expect(last).toBe(409);
  });

  it("an administrator's switches rule the API: the global switch, the plan's quota, the pace — every change audited, an owner cannot touch them", async () => {
    const admin = sessions.admin;
    const key = (await call(create, "POST", "/api/me/api-keys", { cookie: sessions.other, json: { name: "switch", scopes: ["clients:read"], expiresInDays: 7 } })).body.key as string;
    expect((await call(clients, "GET", "/api/v1/clients", { bearer: key })).status).toBe(200);
    expect((await call(adminSettings, "GET", "/api/admin/settings", { cookie: sessions.owner })).status).toBe(403);
    expect((await call(setSetting, "PUT", "/x", { cookie: sessions.owner, params: { key: "features.apiKeys" }, json: { value: false } })).status).toBe(403);
    const screen = (await call(adminSettings, "GET", "/api/admin/settings", { cookie: admin })).body;
    expect(screen.settings.map((x: { key: string }) => x.key)).toContain("features.apiKeys");
    expect(screen.values["features.apiKeys"]).toEqual({ value: true, source: "default" });
    // switch off: creating and using are refused, said as FEATURE_OFF
    expect((await call(setSetting, "PUT", "/x", { cookie: admin, params: { key: "features.apiKeys" }, json: { value: false } })).status).toBe(200);
    resetAppSettings();
    expect((await call(create, "POST", "/api/me/api-keys", { cookie: sessions.other, json: { name: "x", scopes: ["clients:read"], expiresInDays: 7 } })).body.code).toBe("FEATURE_OFF");
    expect((await call(clients, "GET", "/api/v1/clients", { bearer: key })).status).toBe(403);
    // back on; a plan without an API
    expect((await call(resetSetting, "DELETE", "/x", { cookie: admin, params: { key: "features.apiKeys" }, json: {} })).status).toBe(200);
    expect((await call(setSetting, "PUT", "/x", { cookie: admin, params: { key: "plans.free.apiKeys" }, json: { value: 0 } })).status).toBe(200);
    resetAppSettings();
    expect((await call(create, "POST", "/api/me/api-keys", { cookie: sessions.other, json: { name: "y", scopes: ["clients:read"], expiresInDays: 7 } })).body.code).toBe("API_PLAN");
    expect((await call(setSetting, "PUT", "/x", { cookie: admin, params: { key: "plans.free.apiKeys" }, json: { value: 500 } })).body.code).toBe("BAD_VALUE");
    await call(resetSetting, "DELETE", "/x", { cookie: admin, params: { key: "plans.free.apiKeys" }, json: {} });
    resetAppSettings();
    const history = (await call(settingsHistory, "GET", "/api/admin/settings/history?key=features.apiKeys", { cookie: admin })).body.history as { before: unknown; after: unknown; actorLabel: string }[];
    expect(history.map((h) => [h.before, h.after])).toEqual([[false, null], [null, false]]);
    expect(history[0]!.actorLabel).toBe(`admin-${stamp}@akinaza.test`);
  });
});
