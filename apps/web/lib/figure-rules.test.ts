import { ACTION_KINDS, computeFigures, DEFAULT_FIGURE_THRESHOLDS, FIGURE_ID, LEXICON, nextActions } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { SETTINGS } from "./settings";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

const FIXTURE = {
  today: "2026-12-20",
  computedAt: "2026-12-20T12:00:00.000Z",
  period: { start: "2026-10-01", end: "2026-12-31" },
  invoices: [{ id: "i1", number: "F-1", issuedOn: "2026-10-03", dueOn: "2026-10-10", subtotalCents: 10_000, gstCents: 500, qstCents: 998, totalCents: 11_498, paidCents: 0, isCredit: false, superseded: false }],
  payments: [],
  expenses: [{ id: "e1", supplier: "S", paidOn: "2026-10-05", subtotalCents: 1_000, gstCents: 50, qstCents: 100, businessSharePct: 100 }],
  appointments: [{ id: "a1", day: "2026-10-04", status: "done" as const }, { id: "a2", day: "2026-10-05", status: "noShow" as const }],
};

describe("the administrator's defaults are the domain's defaults (#260)", () => {
  it("every threshold setting has the default the domain judges by, global and bounded", () => {
    const map: Record<string, keyof typeof DEFAULT_FIGURE_THRESHOLDS> = {
      "figures.overdueWatchPct": "overdueWatchPct", "figures.overdueAlertPct": "overdueAlertPct", "figures.collectedWatchPct": "collectedWatchPct", "figures.collectedAlertPct": "collectedAlertPct",
      "figures.marginWatchPct": "marginWatchPct", "figures.marginAlertPct": "marginAlertPct", "figures.noShowWatchPct": "noShowWatchPct", "figures.noShowAlertPct": "noShowAlertPct",
      "figures.taxPeriodSoonDays": "taxPeriodSoonDays", "figures.emptySlotMaxFillPct": "emptySlotMaxFillPct", "figures.emptySlotMinOffered": "emptySlotMinOffered", "figures.maxActions": "maxActions",
    };
    for (const [key, field] of Object.entries(map)) {
      const def = SETTINGS[key as keyof typeof SETTINGS] as { default: unknown; scopes: readonly string[]; schema: { safeParse: (v: unknown) => { success: boolean } }; max?: number; min?: number };
      expect(def.default, key).toBe(DEFAULT_FIGURE_THRESHOLDS[field]);
      expect(def.scopes, key).toEqual(["global"]);
      expect(def.schema.safeParse((def.max ?? 0) + 1).success, key).toBe(false);
    }
    expect(Object.keys(map)).toHaveLength(Object.keys(DEFAULT_FIGURE_THRESHOLDS).length);
  });

  it("offers every kind of action by default, and refuses an unknown one", () => {
    expect(SETTINGS["figures.actions"].default).toEqual([...ACTION_KINDS]);
    expect(SETTINGS["figures.actions"].schema.safeParse(["chase", "invent"]).success).toBe(false);
  });
});

describe("the words the figures and actions need exist in French and English (#260)", () => {
  const figures = computeFigures(FIXTURE, DEFAULT_FIGURE_THRESHOLDS);
  const actions = nextActions({ figures: FIXTURE, returnPrepared: false, slots: [{ weekday: 2, startsAt: "10:00", offered: 8, booked: 0 }] }, DEFAULT_FIGURE_THRESHOLDS, ACTION_KINDS);

  it.each([["en", en], ["fr", fr]] as const)("%s: a name, a meaning and a formula for every figure; a label for every formula term; the states and sources", (_l, m) => {
    const c = m.console.figures as Record<string, unknown>;
    for (const id of Object.values(FIGURE_ID)) expect(c[id], id).toMatchObject({ name: expect.any(String), meaning: expect.any(String), formula: expect.any(String) });
    for (const figure of Object.values(figures)) for (const term of figure.formula) expect((c.terms as Record<string, string>)[term.label], term.label).toBeTruthy();
    for (const state of ["good", "watch", "alert", "info"]) expect((c.state as Record<string, string>)[state]).toBeTruthy();
    for (const kind of ["invoice", "expense", "payment", "appointment"]) expect((c.sources as Record<string, string>)[kind]).toBeTruthy();
  });

  it.each([["en", en], ["fr", fr]] as const)("%s: a title, a why and a button for every action kind", (_l, m) => {
    const a = m.console.figures.actions as Record<string, Record<string, string>>;
    expect(actions.map((x) => x.kind).sort()).toEqual([...ACTION_KINDS].sort());
    for (const kind of ACTION_KINDS) for (const key of ["title", "why", "cta"]) expect(a[kind]![key], `${kind}.${key}`).toBeTruthy();
  });

  it.each([["en", en], ["fr", fr]] as const)("%s: every lexique term linked from a figure is defined, and nothing says AI", (_l, m) => {
    const terms = m.console.lexicon.terms as Record<string, { term: string; definition: string }>;
    for (const t of LEXICON) expect(terms[t.id], t.id).toMatchObject({ term: expect.any(String), definition: expect.any(String) });
    for (const figure of Object.values(figures)) for (const id of figure.lexicon) expect(terms[id], id).toBeDefined();
    expect(m.console.lexicon.accountant).toBeTruthy();
    expect(JSON.stringify([m.console.figures, m.console.lexicon])).not.toMatch(/\bIA\b|\bAI\b|intelligen/i);
  });

  it("the tax return is prepared, never filed: the words say so", () => {
    expect(en.console.figures.actions.taxes.why).toContain("you file the return yourself");
    expect(fr.console.figures.actions.taxes.why).toContain("vous produisez la déclaration vous-même");
    expect(JSON.stringify(en.console.figures)).not.toMatch(/we file|filed for you|transmit/i);
  });
});
