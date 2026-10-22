import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as saveShop } from "./walker/shop/route";
import { POST as makeDefault } from "./walker/shops/[id]/default/route";
import { GET as listShops, POST as addShop } from "./walker/shops/route";

/** An owner with two shops, over HTTP, on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { token?: string; json?: unknown; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }), { params: Promise.resolve((opts.params ?? {}) as never) });
  return { status: res.status, body: (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : null };
}

describe.runIf(enabled)("an owner with two shops over HTTP", () => {
  const stamp = Date.now();
  const tokens: Record<string, string> = {};
  const page = (slug: string) => ({ name: slug, legalName: slug, address: "1 rue Test", slug: `${slug}-${stamp}`, ownerName: "Éric" });
  beforeAll(async () => {
    await migrate();
    for (const label of ["owner", "stranger"]) {
      const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [`${label}-${stamp}@akinaza.test`]);
      tokens[label] = (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token;
    }
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  it("lists, adds, edits and switches shops — and only for the owner", async () => {
    expect((await call(listShops, "GET", "/api/walker/shops")).status).toBe(401);
    const owner = tokens.owner;
    const first = (await call(saveShop, "POST", "/api/walker/shop", { token: owner, json: page("un") })).body.shopId as string;
    const second = await call(addShop, "POST", "/api/walker/shops", { token: owner, json: page("deux") });
    expect(second.status).toBe(201);
    const list = (await call(listShops, "GET", "/api/walker/shops", { token: owner })).body.shops as { id: string; isDefault: boolean }[];
    expect(list.map((s) => [s.id, s.isDefault])).toEqual([[first, true], [second.body.shopId, false]]);
    // edits one shop by its id
    expect((await call(saveShop, "POST", `/api/walker/shop?shopId=${second.body.shopId}`, { token: owner, json: { ...page("deux"), name: "Deux, renommé" } })).body.created).toBe(false);
    // switches
    expect((await call(makeDefault, "POST", "/x", { token: owner, params: { id: second.body.shopId } })).status).toBe(200);
    expect(((await call(listShops, "GET", "/api/walker/shops", { token: owner })).body.shops as { id: string }[])[0]!.id).toBe(second.body.shopId);
    // a stranger cannot see, switch or edit them
    expect((await call(makeDefault, "POST", "/x", { token: tokens.stranger, params: { id: first } })).status).toBe(404);
    expect((await call(saveShop, "POST", `/api/walker/shop?shopId=${first}`, { token: tokens.stranger, json: page("vol") })).status).toBe(404);
    expect((await call(listShops, "GET", "/api/walker/shops", { token: tokens.stranger })).body.shops).toEqual([]);
  });
});
