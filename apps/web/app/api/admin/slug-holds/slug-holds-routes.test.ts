import { describe, expect, it, vi } from "vitest";

import { refuse } from "@/lib/http";

const gate = vi.hoisted(() => ({ session: null as null | { account: { id: string; email: string } } }));
vi.mock("@/lib/access", () => ({
  requireAdmin: async () => {
    if (!gate.session) {throw refuse(401, "UNAUTHENTICATED", "Sign in first");}
    if (gate.session.account.email.startsWith("user")) {throw refuse(403, "FORBIDDEN", "Administrators only");}
    return gate.session;
  },
}));
const calls = vi.hoisted(() => ({ listed: 0, cleared: [] as string[], kept: [] as { id: string; reason: string }[], audited: [] as unknown[], rejudged: [] as boolean[] }));
vi.mock("@akinaza/db", async (original) => ({
  ...(await original<typeof import("@akinaza/db")>()),
  heldShops: async () => (calls.listed++, [{ shopId: "11111111-1111-4111-8111-111111111111", name: "Salon", slug: "login-salon", term: "login", heldAt: null, ownerId: null }]),
  clearSlugHold: async (_db: unknown, id: string) => (calls.cleared.push(id), id.startsWith("1")),
  keepSlugHold: async (_db: unknown, id: string, reason: string) => (calls.kept.push({ id, reason }), id.startsWith("1")),
}));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/audit", () => ({ audit: async (entry: unknown) => void calls.audited.push(entry) }));

vi.mock("@/lib/env", () => ({ mailSettings: () => ({ provider: "none", apiUrl: "http://x", appUrl: "http://x" }) }));
vi.mock("@/lib/slug-rejudge", () => ({ rejudgeAndNotify: async (_db: unknown, o: { apply: boolean }) => (calls.rejudged.push(o.apply), { shops: [{ shopId: HELD_ID, name: "Salon", slug: "login-salon", matched: "login", ownerEmail: "o@x.test" }], notified: o.apply ? 1 : 0 }) }));
const HELD_ID = "11111111-1111-4111-8111-111111111111";

import { POST as keep } from "./[id]/keep/route";
import { POST as clear } from "./[id]/route";
import { POST as rejudge } from "./rejudge/route";
import { GET as list } from "./route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = () => new Request("http://x/api/admin/slug-holds/x", { method: "POST" });
const HELD = "11111111-1111-4111-8111-111111111111";

describe("the held shop addresses are for administrators only (ADR-005, #537)", () => {
  it("answers 401 without a session and 403 to a non-administrator, and does nothing", async () => {
    for (const session of [null, { account: { id: "u", email: "user@x.test" } }]) {
      gate.session = session;
      const status = session ? 403 : 401;
      expect((await list(new Request("http://x"))).status).toBe(status);
      expect((await clear(post(), ctx(HELD))).status).toBe(status);
    }
    expect(calls.listed).toBe(0);
    expect(calls.cleared).toEqual([]);
  });

  it("lists the queue and clears one hold, audited", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    const body = (await (await list(new Request("http://x"))).json()) as { held: { slug: string; term: string }[] };
    expect(body.held).toMatchObject([{ slug: "login-salon", term: "login" }]);
    expect((await clear(post(), ctx(HELD))).status).toBe(200);
    expect(calls.cleared).toEqual([HELD]);
    expect(calls.audited).toMatchObject([{ action: "shop.slug_hold_cleared", targetId: HELD }]);
  });

  it("answers 404 for a shop that is not held and 400 for an id that is not one", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    expect((await clear(post(), ctx("22222222-2222-4222-8222-222222222222"))).status).toBe(404);
    expect((await clear(post(), ctx("nope"))).status).toBe(400);
  });
});

const json = (body: unknown) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("keeping a hold and re-judging the shops that predate it (ADR-005, #537)", () => {
  it("refuses everyone but an administrator, and does nothing", async () => {
    for (const session of [null, { account: { id: "u", email: "user@x.test" } }]) {
      gate.session = session;
      const status = session ? 403 : 401;
      expect((await keep(json({ reason: "x" }), ctx(HELD))).status).toBe(status);
      expect((await rejudge(json({ apply: true }))).status).toBe(status);
    }
    expect(calls.kept).toEqual([]);
    expect(calls.rejudged).toEqual([]);
  });

  it("keeps a hold with a reason, audited with the reason; a missing reason is a 400 and an unheld shop a 404", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    expect((await keep(json({ reason: "  looks like a bank  " }), ctx(HELD))).status).toBe(200);
    expect(calls.kept).toEqual([{ id: HELD, reason: "looks like a bank" }]);
    expect(calls.audited.at(-1)).toMatchObject({ action: "shop.slug_hold_kept", targetId: HELD, detail: { reason: "looks like a bank" } });
    expect((await keep(json({ reason: "   " }), ctx(HELD))).status).toBe(400);
    expect((await keep(json({}), ctx(HELD))).status).toBe(400);
    expect((await keep(json({ reason: "x" }), ctx("22222222-2222-4222-8222-222222222222"))).status).toBe(404);
  });

  it("is a dry run by default (not audited), and audited with the numbers when applied", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    const before = calls.audited.length;
    const dry = (await (await rejudge(json({}))).json()) as { apply: boolean; shops: unknown[]; notified: number };
    expect(dry).toMatchObject({ apply: false, notified: 0 });
    expect(dry.shops).toHaveLength(1);
    expect(calls.audited).toHaveLength(before);
    await rejudge(json({ apply: true }));
    expect(calls.rejudged).toEqual([false, true]);
    expect(calls.audited.at(-1)).toMatchObject({ action: "shop.slug_rejudged", detail: { held: 1, notified: 1 } });
  });
});
