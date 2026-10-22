import { describe, expect, it } from "vitest";

import { DEFAULT_BRIEF_RULES, marketingConsent, type ShopRecommendation, shopBrief } from ".";
import type { BriefSnapshot } from "./snapshot";

/** A fictional salon: 8 weeks of visits, three services, six clients. Every expected figure is worked out by hand below. */
const visit = (n: number, serviceId: string, minutes: number, clientId: string | null, days: string[]) =>
  Array.from({ length: n }, (_, i) => ({ id: `${serviceId}-${clientId ?? "walk-in"}-${i}`, serviceId, clientId, minutes, day: days[i % days.length]! }));

const salon = (): BriefSnapshot => ({
  week: "2026-W43",
  today: "2026-10-19",
  services: [
    { id: "cut", priceCents: 4000, durationMinutes: 60, priceVaries: false },
    { id: "colour", priceCents: 15000, durationMinutes: 90, priceVaries: false },
    { id: "care", priceCents: 4500, durationMinutes: 30, priceVaries: false },
  ],
  done: [
    // cut: 14 × 60 min — Saturdays for c1 (last 2026-08-29), Thursdays for c3 (no marketing consent).
    ...visit(4, "cut", 60, "c1", ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-29"]),
    ...visit(5, "cut", 60, "c3", ["2026-07-23", "2026-07-30", "2026-08-06", "2026-08-13", "2026-08-20"]),
    ...visit(5, "cut", 60, null, ["2026-09-10"]),
    // colour: 8 × 90 min — Tuesdays for c2 (last 2026-09-01), c4 only twice, c6 erased.
    ...visit(3, "colour", 90, "c2", ["2026-08-18", "2026-08-25", "2026-09-01"]),
    ...visit(2, "colour", 90, "c4", ["2026-08-04", "2026-08-11"]),
    ...visit(1, "colour", 90, "c6", ["2026-08-12"]),
    ...visit(2, "colour", 90, null, ["2026-09-15"]),
    // care: 10 × 30 min — c5 came on 2026-10-10 (not dormant).
    ...visit(6, "care", 30, "c5", ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26", "2026-10-03", "2026-10-10"]),
    ...visit(4, "care", 30, null, ["2026-09-20"]),
  ],
  ahead: [
    { day: "2026-10-22", openMinutes: 480, bookedMinutes: 300 }, // Thursday: 180 free
    { day: "2026-10-23", openMinutes: 480, bookedMinutes: 480 }, // Friday: full
    { day: "2026-10-24", openMinutes: 240, bookedMinutes: 0 }, // Saturday: 240 free
  ],
  clients: [
    { id: "c1", contactable: true, marketing: true, erased: false },
    { id: "c2", contactable: true, marketing: true, erased: false },
    { id: "c3", contactable: true, marketing: false, erased: false },
    { id: "c4", contactable: true, marketing: true, erased: false },
    { id: "c5", contactable: true, marketing: true, erased: false },
    { id: "c6", contactable: false, marketing: false, erased: true },
  ],
  lastWeek: {
    invoices: [
      { id: "i1", number: "2026-0101", issuedOn: "2026-10-13", totalCents: 11498, gstCents: 500, qstCents: 998 },
      { id: "i2", number: "2026-0102", issuedOn: "2026-10-16", totalCents: 4599, gstCents: 200, qstCents: 399 },
    ],
    expenses: [{ id: "e1", supplier: "Fournitures Laval", paidOn: "2026-10-14", gstCents: 100, qstCents: 200, businessSharePct: 50 }],
  },
});

const find = (items: readonly ShopRecommendation[], kind: string) => items.find((i) => i.kind === kind)!;

describe("the Monday brief of a salon", () => {
  const brief = shopBrief(salon());

  it("keeps three cards: the gaps first (time-bound), then the largest gain", () => {
    expect(brief.items.map((i) => i.kind)).toEqual(["gaps", "pricing", "taxes"]);
    expect(brief.items.map((i) => i.id)).toEqual(["2026-W43:gaps:ahead", "2026-W43:pricing:cut", "2026-W43:taxes:lastWeek"]);
  });

  it("gaps: 420 free minutes at the shop's rate (221 000 ¢ / 1 860 min) = 49 903 ¢, and the two regulars to invite", () => {
    const gaps = find(brief.items, "gaps");
    expect(gaps.figures).toEqual({ freeMinutes: 420, freeSlots: 7, freeDays: 2, missedCents: 49903, invitees: 2, dormantDays: 42 });
    // c1 usually comes on Saturday, a free day: first. c3 (no consent), c4 (two visits), c5 (recent), c6 (erased) never.
    expect(gaps.action).toEqual({ kind: "invite", payload: { clientIds: ["c1", "c2"], days: ["2026-10-22", "2026-10-24"] } });
  });

  it("pricing: the cut takes 45 % of the time for 25 % of the revenue; +6 $ (capped at 15 %) = 4 550 ¢ a month at equal volume", () => {
    const cut = find(brief.items, "pricing");
    expect(cut.figures).toEqual({ timeSharePct: 45, revenueSharePct: 25, currentCents: 4000, suggestedCents: 4600, raiseCents: 600, monthlyGainCents: 4550 });
    expect(cut.assumptions).toEqual(["equalVolume", "revenueNotMargin"]);
    expect(brief.items.filter((i) => i.kind === "pricing")).toHaveLength(1); // colour and care earn above the average
  });

  it("taxes: 2 097 ¢ collected − 150 ¢ of credits (half business) = 1 947 ¢ to set aside out of 16 097 ¢", () => {
    expect(find(brief.items, "taxes").figures).toEqual({ invoicedCents: 16097, collectedCents: 2097, creditsCents: 150, setAsideCents: 1947, availableCents: 14150 });
  });

  it("says nothing on gaps and prices when the history is too thin, but still the taxes", () => {
    const thin = { ...salon(), done: salon().done.slice(0, DEFAULT_BRIEF_RULES.minDoneVisits - 1) };
    expect(shopBrief(thin).items.map((i) => i.kind)).toEqual(["taxes"]);
  });

  it("says nothing on taxes for a week without invoices", () => {
    expect(shopBrief({ ...salon(), lastWeek: { invoices: [], expenses: [] } }).items.map((i) => i.kind)).toEqual(["gaps", "pricing"]);
  });

  it("no free time, no gap card; no regular to invite, no gap card", () => {
    const full = { ...salon(), ahead: salon().ahead.map((d) => ({ ...d, bookedMinutes: d.openMinutes })) };
    expect(shopBrief(full).items.map((i) => i.kind)).not.toContain("gaps");
    const nobody = { ...salon(), clients: salon().clients.map((c) => ({ ...c, marketing: false })) };
    expect(shopBrief(nobody).items.map((i) => i.kind)).not.toContain("gaps");
  });

  it("no price advice on a « from » price", () => {
    const from = { ...salon(), services: salon().services.map((s) => (s.id === "cut" ? { ...s, priceVaries: true } : s)) };
    expect(shopBrief(from).items.map((i) => i.kind)).not.toContain("pricing");
  });

  it("the falcon vetoes an invitation to anyone without a granted marketing consent", () => {
    const gaps = find(brief.items, "gaps");
    const tampered = { ...gaps, action: { kind: "invite" as const, payload: { clientIds: ["c1", "c3"], days: [] } } };
    expect(marketingConsent.check(tampered, { snapshot: salon(), rules: DEFAULT_BRIEF_RULES })).toBe("NO_MARKETING_CONSENT");
    expect(marketingConsent.check(gaps, { snapshot: salon(), rules: DEFAULT_BRIEF_RULES })).toBeNull();
  });

  it("is the same brief for the same data (ids are stable, so actions are idempotent)", () => {
    expect(shopBrief(salon())).toEqual(brief);
  });
});
