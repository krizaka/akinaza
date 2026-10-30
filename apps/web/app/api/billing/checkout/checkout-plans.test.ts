import { describe, expect, it, vi } from "vitest";


const state = vi.hoisted(() => ({
  approved: false,
  eligible: true,
  secret: "sk_test_x",
  trial: true,
  amounts: { starter: 2900, scale: 6900, association: 100, founder: 3900 } as Record<string, number>,
  requests: [] as Record<string, unknown>[],
  recorded: [] as string[],
}));

vi.mock("@/app/system-clock", () => ({ systemClock: { now: () => new Date("2026-11-01T12:00:00Z") } }));
vi.mock("@/lib/access", () => ({ requireSession: async () => ({ account: { id: "acc-1", email: "owner@example.test", locale: "en" } }) }));
vi.mock("@/lib/audit", () => ({ audit: async () => undefined }));
vi.mock("@/lib/db", () => ({ db: () => ({}), query: async () => [] }));
vi.mock("@/lib/rate-limit", () => ({ limit: () => undefined }));
vi.mock("@/lib/env", () => ({ env: () => ({ APP_PUBLIC_URL: "https://akinaza.test", PAYMENTS_STRIPE_SECRET_KEY: state.secret }) }));
vi.mock("@/lib/billing", () => ({
  customerOf: async () => "cus_1",
  founderGate: async () => "open",
  recordOfferedVersion: async (_q: unknown, _a: string, v: string) => void state.recorded.push(v),
  trialEligible: async () => state.eligible,
}));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), associationApproved: async () => state.approved }));
vi.mock("@/lib/price-catalogue", async () => {
  const { pricesInForce: inForce } = await import("@/lib/test-prices");
  const catalogue = await inForce(new Date("2026-11-01T12:00:00Z"));
  return { appPrices: () => catalogue };
});
vi.mock("@/lib/payments/config", async (original) => ({
  ...(await original<typeof import("@/lib/payments/config")>()),
  paymentsFrom: () => ({
    capabilities: { trial: state.trial },
    price: async (kind: string) => ({ amount: state.amounts[kind] ?? 0, currency: "cad", interval: "month" }),
    createCustomer: async () => ({ id: "cus_1" }),
    checkout: async (request: Record<string, unknown>) => (state.requests.push(request), { url: "https://pay.test/s", checkoutRef: "cs_1", expiresAt: null }),
  }),
}));

import { POST } from "./route";

const call = (plan: string) => POST(new Request(`http://x/api/billing/checkout?plan=${plan}&locale=en`, { method: "POST" }));
const body = async (r: Response) => (await r.json()) as { code?: string; url?: string };
const reset = () => Object.assign(state, { approved: false, eligible: true, secret: "sk_test_x", trial: true, requests: [], recorded: [] });

describe("the checkout sells a plan of the catalogue, with its free months (ADR-003 addendum 2026-10-30)", () => {
  it("Starter starts with the entry's 90 free days, and the version offered is the new 29 $ one", async () => {
    reset();
    const r = await call("starter");
    expect(r.status).toBe(200);
    expect(state.requests[0]).toMatchObject({ kind: "starter", trialDays: 90 });
    expect(state.recorded[0]).not.toBe("seed:akinaza.starter");
  });

  it("an account that already had a subscription gets no trial (once per account)", async () => {
    reset();
    state.eligible = false;
    await call("starter");
    expect(state.requests[0]!.trialDays).toBeUndefined();
  });

  it("Pro has no trial", async () => {
    reset();
    await call("scale");
    expect(state.requests[0]).toMatchObject({ kind: "scale" });
    expect(state.requests[0]!.trialDays).toBeUndefined();
  });

  it("refuses a trial on a live processor key, and never says free and charges when the adapter cannot carry the free days", async () => {
    reset();
    state.secret = "sk_live_x";
    expect(await body(await call("starter"))).toMatchObject({ code: "TRIAL_TEST_MODE_ONLY" });
    reset();
    state.trial = false;
    expect(await body(await call("starter"))).toMatchObject({ code: "TRIAL_NOT_READY" });
    expect(state.requests).toEqual([]);
  });

  it("Association: refused until an administrator approved the proof (403), then it starts with its free months", async () => {
    reset();
    const refused = await call("association");
    expect([refused.status, (await body(refused)).code]).toEqual([403, "ASSOCIATION_NOT_APPROVED"]);
    expect(state.requests).toEqual([]);
    state.approved = true;
    expect((await call("association")).status).toBe(200);
    expect(state.requests[0]).toMatchObject({ kind: "association", trialDays: 90 });
  });

  it("sells nothing when the processor is still on another amount, and the founder offer (ended) is no longer sold", async () => {
    reset();
    state.amounts = { ...state.amounts, starter: 4500 };
    expect(await body(await call("starter"))).toMatchObject({ code: "PRICE_NOT_READY" });
    state.amounts = { ...state.amounts, starter: 2900 };
    expect(await body(await call("founder"))).toMatchObject({ code: "FOUNDER_OFFER_FULL" });
    expect((await call("enterprise")).status).toBe(400);
  });
});
