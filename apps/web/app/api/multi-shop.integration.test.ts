import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as saveShop } from "./walker/shop/route";
import { PATCH as patchCollection } from "./walker/shop-collections/[id]/route";
import { GET as listCollections, POST as addCollection } from "./walker/shop-collections/route";
import { POST as addTag } from "./walker/shop-tags/route";
import { POST as makeDefault } from "./walker/shops/[id]/default/route";
import { PATCH as patchShop } from "./walker/shops/[id]/route";
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
  // Unique across test files run in parallel: two files starting in the same millisecond collided on accounts_email_unique.
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
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

  it("gives each shop a description, an avatar, tags and a collection — the package's — for the owner only", async () => {
    const owner = tokens.owner;
    const shops = (await call(listShops, "GET", "/api/walker/shops", { token: owner })).body.shops as { id: string; collectionId: string }[];
    const [a, b] = [shops[0]!.id, shops[1]!.id];
    const tag = (await call(addTag, "POST", "/api/walker/shop-tags", { token: owner, json: { name: "centre", color: "blue" } })).body.tag.id as string;
    const group = (await call(addCollection, "POST", "/api/walker/shop-collections", { token: owner, json: { name: "Montréal" } })).body.collection.id as string;
    const patched = await call(patchShop, "PATCH", "/x", { token: owner, params: { id: a }, json: { description: "  Le salon  ", avatar: { kind: "set", seed: "plain-2" }, tagIds: [tag], collectionId: group } });
    expect(patched.status).toBe(200);
    expect(patched.body.shop).toMatchObject({ description: "Le salon", avatar: { kind: "set", seed: "plain-2" }, collectionId: group });
    expect(patched.body.tags.map((t: { name: string }) => t.name)).toEqual(["centre"]);
    expect((await call(patchShop, "PATCH", "/x", { token: owner, params: { id: a }, json: { avatar: { kind: "set", seed: "nope" } } })).body.code).toBe("AVATAR_NOT_ALLOWED");
    const listed = (await call(listShops, "GET", "/api/walker/shops", { token: owner })).body.shops as { id: string; tags: unknown[]; collectionId: string }[];
    expect(listed.find((s) => s.id === a)!.tags).toHaveLength(1);
    expect(listed.find((s) => s.id === b)!.collectionId).not.toBe(group);
    // the owner's default collection is there and cannot be removed; another one can become the default
    const cols = (await call(listCollections, "GET", "/api/walker/shop-collections", { token: owner })).body.collections as { id: string; isDefault: boolean }[];
    expect(cols.filter((c) => c.isDefault)).toHaveLength(1);
    expect((await call(patchCollection, "PATCH", "/x", { token: owner, params: { id: group }, json: { default: true } })).status).toBe(200);
    // a stranger cannot touch the owner's shop
    expect((await call(patchShop, "PATCH", "/x", { token: tokens.stranger, params: { id: a }, json: { description: "vol" } })).status).toBe(404);
  });
});
