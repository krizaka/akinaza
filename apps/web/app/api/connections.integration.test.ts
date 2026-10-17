import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db, migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { GET as callback } from "./walker/connections/[platform]/callback/route";
import { POST as connect } from "./walker/connections/[platform]/connect/route";
import { POST as disconnect } from "./walker/connections/[platform]/disconnect/route";
import { POST as pull } from "./walker/connections/[platform]/pull/route";
import { POST as push } from "./walker/connections/[platform]/push/route";
import { POST as hours } from "./walker/hours/route";
import { POST as shop } from "./walker/shop/route";
import { POST as decide } from "./walker/sync-proposals/[id]/route";

/** The owner's connections over HTTP, with the in-memory platform, on a real PostgreSQL (DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { token?: string; json?: unknown; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const req = new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined });
  const res = await (handler as Handler)(req, { params: Promise.resolve((opts.params ?? {}) as never) });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, body: type.includes("json") ? await res.json() : null, res };
}

describe.runIf(enabled)("the owner's connections over HTTP", () => {
  const stamp = Date.now();
  const google = { platform: "google" };
  let owner: string;
  let stranger: string;
  let shopId: string;

  const account = async (label: string) => {
    const email = `${label}-${stamp}@akinaza.test`;
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [email]);
    return (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token;
  };

  beforeAll(async () => {
    process.env.APP_SOCIAL_SYNC = "fake";
    await migrate();
    owner = await account("sync-owner");
    stranger = await account("sync-stranger");
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    delete process.env.APP_SOCIAL_SYNC;
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  it("is closed to anyone without a shop, and to unknown platforms", async () => {
    expect((await call(connect, "POST", "/x", { json: { consent: true }, params: google })).status).toBe(401);
    expect((await call(connect, "POST", "/x", { token: stranger, json: { consent: true }, params: google })).status).toBe(403);
    const created = await call(shop, "POST", "/api/walker/shop", { token: owner, json: { name: "Pattes", legalName: "Pattes", address: "1 rue Test", slug: `pattes-sync-${stamp}`, ownerName: "Mathilde", published: false } });
    shopId = created.body.shopId;
    for (const weekday of [1, 2, 3]) await call(hours, "POST", "/x", { token: owner, json: { weekday, startsAt: "08:00", endsAt: "12:00" } });
    expect((await call(connect, "POST", "/x", { token: owner, json: { consent: true }, params: { platform: "apple" } })).status).toBe(404);
  });

  it("connects only with consent and a state this server signed, then the owner reviews and decides", async () => {
    expect((await call(connect, "POST", "/x", { token: owner, json: { consent: false }, params: google })).body).toMatchObject({ code: "SYNC_NO_CONSENT" });
    const started = await call(connect, "POST", "/x", { token: owner, json: { consent: true }, params: google });
    const target = new URL(started.body.authorizeUrl);
    const state = target.searchParams.get("state")!;
    expect((await call(callback, "GET", `/x?code=fake-code&state=forged`, { token: owner, params: google })).status).toBe(400);
    expect((await call(callback, "GET", `/x?code=fake-code&state=${state}`, { token: stranger, params: google })).status).toBe(403); // another account cannot finish it
    const back = await call(callback, "GET", `/x?code=${target.searchParams.get("code")}&state=${state}`, { token: owner, params: google });
    expect(back.status).toBe(303);
    expect(back.res.headers.get("location")).toContain("connected=google");

    const stored = await query<{ token_enc: string }>("SELECT token_enc FROM social_connections WHERE shop_id = $1", [shopId]);
    expect(stored[0]!.token_enc).toMatch(/^v1\./);
    expect(stored[0]!.token_enc).not.toContain("fake-access");

    const pulled = await call(pull, "POST", "/x", { token: owner, params: google });
    expect(pulled.body.needsDecision.sort()).toEqual(["description", "hours", "phone", "website"]);
    expect(JSON.stringify(pulled.body)).not.toMatch(/fake-access|fake-refresh/);
    const [proposal] = await query<{ id: string }>("SELECT id FROM sync_proposals WHERE shop_id = $1 AND status = 'open'", [shopId]);
    expect((await call(decide, "POST", "/x", { token: stranger, json: { decisions: [{ field: "phone", decision: "accept" }] }, params: { id: proposal!.id } })).status).toBe(403);
    expect((await call(decide, "POST", "/x", { token: owner, json: { decisions: [{ field: "phone", decision: "accept" }, { field: "hours", decision: "keep" }] }, params: { id: proposal!.id } })).status).toBe(200);
    const [row] = await query<{ public_phone: string }>("SELECT public_phone FROM shops WHERE id = $1", [shopId]);
    expect(row!.public_phone).toBe("(514) 555-0123");

    const pushed = await call(push, "POST", "/x", { token: owner, params: google });
    expect(pushed.body.pushed).toEqual(["hours"]); // kept by the owner; the rest still awaits a decision
    expect(pushed.body.needsDecision.sort()).toEqual(["description", "website"]);
  });

  it("disconnects: the token is gone, the log keeps the story without any secret", async () => {
    expect((await call(disconnect, "POST", "/x", { token: owner, params: google })).status).toBe(200);
    const stored = await query<{ token_enc: string | null; status: string }>("SELECT token_enc, status FROM social_connections WHERE shop_id = $1", [shopId]);
    expect(stored[0]).toEqual({ token_enc: null, status: "disconnected" });
    expect((await call(pull, "POST", "/x", { token: owner, params: google })).body).toMatchObject({ code: "SYNC_NOT_CONNECTED" });
    const log = JSON.stringify(await query("SELECT * FROM sync_log WHERE shop_id = $1", [shopId]));
    expect(log).toContain("disconnected");
    expect(log).not.toMatch(/fake-access|fake-refresh/);
    expect(db()).toBeTruthy();
  });
});
