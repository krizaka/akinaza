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
const calls = vi.hoisted(() => ({ listed: 0, decided: [] as unknown[][], audited: [] as { action: string }[] }));
vi.mock("@akinaza/db", async (original) => ({
  ...(await original<typeof import("@akinaza/db")>()),
  pendingAssociations: async () => (calls.listed++, [{ id: "11111111-1111-4111-8111-111111111111", email: "oblique@example.test", kind: "neq", reference: "1234567890" }]),
  decideAssociation: async (_db: unknown, ...args: unknown[]) => (calls.decided.push(args), String(args[0]).startsWith("1")),
}));
vi.mock("@/app/system-clock", () => ({ systemClock: { now: () => new Date("2026-11-02T15:00:00Z") } }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/audit", () => ({ audit: async (entry: { action: string }) => void calls.audited.push(entry) }));

import { POST as decide } from "./[id]/route";
import { GET as list } from "./route";

const PROOF = "11111111-1111-4111-8111-111111111111";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => new Request("http://x/api/admin/associations/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("the association queue is for administrators only (ADR-003 addendum 2026-10-30)", () => {
  it("answers 401 without a session and 403 to a non-administrator, and decides nothing", async () => {
    for (const session of [null, { account: { id: "u", email: "user@x.test" } }]) {
      gate.session = session;
      const status = session ? 403 : 401;
      expect((await list(new Request("http://x"))).status).toBe(status);
      expect((await decide(post({ decision: "approved" }), ctx(PROOF))).status).toBe(status);
    }
    expect(calls.listed).toBe(0);
    expect(calls.decided).toEqual([]);
  });

  it("lists the queue, approves one proof and refuses another with a reason, each audited", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    const body = (await (await list(new Request("http://x"))).json()) as { pending: { reference: string }[] };
    expect(body.pending).toMatchObject([{ reference: "1234567890" }]);
    expect((await decide(post({ decision: "approved" }), ctx(PROOF))).status).toBe(200);
    expect((await decide(post({ decision: "rejected", note: "Not in the register" }), ctx(PROOF))).status).toBe(200);
    const at = new Date("2026-11-02T15:00:00Z");
    expect(calls.decided).toEqual([[PROOF, "a", "approved", at, undefined], [PROOF, "a", "rejected", at, "Not in the register"]]);
    expect(calls.audited.map((a) => a.action)).toEqual(["billing.association_approved", "billing.association_rejected"]);
  });

  it("answers 404 for a proof already decided or unknown, 400 for a decision that is not one", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    expect((await decide(post({ decision: "approved" }), ctx("22222222-2222-4222-8222-222222222222"))).status).toBe(404);
    expect((await decide(post({ decision: "maybe" }), ctx(PROOF))).status).toBe(400);
    expect((await decide(post({ decision: "approved" }), ctx("not-an-id"))).status).toBe(400);
  });
});
