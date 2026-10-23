import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as shop } from "./walker/shop/route";
import { POST as addShop } from "./walker/shops/route";

/**
 * « Add a shop » end to end (#265): the first shop, a second one through each of the two routes, and the administrator's bound enforced by the service
 * for both, even when requests arrive together. On a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=...).
 */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
type Handler = (req: Request) => Promise<Response>;

describe.runIf(enabled)("an owner adds shops", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `owner-${stamp}@akinaza.test`;
  let session = "";
  const page = (n: number) => ({ name: `Atelier ${n}`, legalName: `Atelier ${n} inc.`, address: `${n} rue Exemple, Montréal QC`, slug: `limit-${stamp}-${n}`, ownerName: "Éric", businessType: "professional" });
  const call = async (handler: Handler, url: string, body: unknown) => {
    const res = await handler(new Request(`http://localhost${url}`, { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${session}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const owned = async () => (await query<{ n: number }>("SELECT count(*)::int AS n FROM shops s JOIN accounts a ON a.id = s.owner_id WHERE a.email = $1", [email]))[0]!.n;

  beforeAll(async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    await migrate();
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [email]);
    session = (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token;
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    vi.unstubAllEnvs();
    await pool().end();
  });

  it("creates the first shop, then a second one with its own address, unpublished, the first staying the default", async () => {
    expect((await call(shop, "/api/walker/shop", page(1))).status).toBe(200);
    const second = await call(shop, "/api/walker/shop?additional=1", { ...page(2), published: true });
    expect(second.status).toBe(201);
    const rows = await query<{ slug: string; published: boolean; is_default: boolean }>("SELECT s.slug, s.published, s.is_default FROM shops s JOIN accounts a ON a.id = s.owner_id WHERE a.email = $1 ORDER BY s.created_at", [email]);
    expect(rows).toEqual([{ slug: `limit-${stamp}-1`, published: false, is_default: true }, { slug: `limit-${stamp}-2`, published: false, is_default: false }]);
  });

  it("refuses at the bound through BOTH routes, and holds when requests arrive together", async () => {
    // The default bound is 5: two more through the plural route and the singular one, then everything is refused, whichever route, however many at once.
    expect((await call(addShop, "/api/walker/shops", page(3))).status).toBe(201);
    expect((await call(shop, "/api/walker/shop?additional=1", page(4))).status).toBe(201);
    expect(await owned()).toBe(4);
    const together = await Promise.all([5, 6, 7, 8].map((n) => (n % 2 ? call(addShop, "/api/walker/shops", page(n)) : call(shop, "/api/walker/shop?additional=1", page(n)))));
    expect(together.filter((r) => r.status === 201)).toHaveLength(1);
    expect(together.filter((r) => r.status === 409).every((r) => r.body.code === "SHOP_LIMIT")).toBe(true);
    expect(await owned()).toBe(5);
    expect((await call(addShop, "/api/walker/shops", page(9))).body).toMatchObject({ code: "SHOP_LIMIT" });
    expect((await call(shop, "/api/walker/shop?additional=1", page(10))).body).toMatchObject({ code: "SHOP_LIMIT" });
  });

  it("without a sign-in neither route creates anything", async () => {
    const res = await shop(new Request("http://localhost/api/walker/shop?additional=1", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page(11)) }));
    expect(res.status).toBe(401);
  });
});
