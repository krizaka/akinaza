import { computeFigures, DEFAULT_FIGURE_THRESHOLDS, FIGURE_ID, FIGURE_STATE, type FigureState, LEXICON, nextActions } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { actionView, kpiThresholds, kpiView, periodId } from "./figures-view";
import { shopRoutes } from "./routes";

const routes = shopRoutes("fr", "11111111-1111-4111-8111-111111111111");
const INPUT = {
  today: "2026-10-23",
  computedAt: "2026-10-23T12:00:00.000Z",
  period: { start: "2026-10-01", end: "2026-12-31" },
  // F-0001: 100 $ + GST 5 $ + QST 9.98 $ = 114.98 $, half paid, 13 days overdue. F-0002 paid in full.
  invoices: [
    { id: "inv-a", number: "F-0001", issuedOn: "2026-10-03", dueOn: "2026-10-10", subtotalCents: 10_000, gstCents: 500, qstCents: 998, totalCents: 11_498, paidCents: 5_000, isCredit: false, superseded: false },
    { id: "inv-b", number: "F-0002", issuedOn: "2026-10-15", dueOn: "2026-11-15", subtotalCents: 20_000, gstCents: 1_000, qstCents: 1_995, totalCents: 22_995, paidCents: 22_995, isCredit: false, superseded: false },
  ],
  payments: [
    { id: "pay-a", invoiceId: "inv-a", amountCents: 5_000, receivedOn: "2026-10-05" },
    { id: "pay-b", invoiceId: "inv-b", amountCents: 22_995, receivedOn: "2026-10-20" },
  ],
  expenses: [{ id: "exp-1", supplier: "Fournisseur", paidOn: "2026-10-05", subtotalCents: 8_000, gstCents: 400, qstCents: 798, businessSharePct: 100 }],
  appointments: [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `ap-${i}`, day: `2026-10-1${i}`, status: "done" as const })),
    { id: "ap-ns", day: "2026-10-14", status: "noShow" as const },
  ],
};
const figures = computeFigures(INPUT, DEFAULT_FIGURE_THRESHOLDS);

/** What `KpiExplained` derives from a value and thresholds (`stateFor` of @krizaka/ui, direction « above »). */
const blockState = (value: number, t: { watchAt: number; actAt: number }) => (value >= t.actAt ? "act" : value >= t.watchAt ? "watch" : "ok");

describe("a figure explains itself (#260)", () => {
  it("gives the block thresholds that reproduce the domain's verdict, for any value", () => {
    const expected: Record<FigureState, "ok" | "watch" | "act"> = { good: "ok", watch: "watch", alert: "act", info: "ok" };
    for (const state of Object.values(FIGURE_STATE)) {
      for (const value of [-250, 0, 1, 4_800, 999_999]) {
        expect(blockState(value, kpiThresholds(state, value)), `${state} ${value}`).toBe(expected[state]);
      }
    }
  });

  it("states the formula with the numbers read from the ledger, in the owner's language", () => {
    const fr1 = kpiView(figures[FIGURE_ID.margin], "fr", routes);
    // 300,00 $ invoiced before taxes - 80,00 $ of expenses = 220,00 $; the formula says so, term by term.
    expect(fr1.value).toBe(22_000);
    expect(fr1.formula).toContain("Factures avant taxes");
    expect(fr1.formula).toMatch(/300,00\s\$/);
    expect(fr1.formula).toMatch(/− Dépenses pour l'entreprise 80,00\s\$/);
    expect(fr1.meaning).toContain("73 %");
    const en1 = kpiView(figures[FIGURE_ID.margin], "en", routes);
    expect(en1.formula).toContain("Invoices before taxes $300.00");
    expect(en1.formula).toContain("− Expenses for the business $80.00");
  });

  it("names its sources and links to their rows", () => {
    const v = kpiView(figures[FIGURE_ID.toCollect], "en", routes);
    expect(v.sources).toBe("1 invoices");
    expect(v.href).toBe(routes.invoices);
    expect(kpiView(figures[FIGURE_ID.gstToRemit], "en", routes).href).toBe(routes.books("2026-Q4"));
    expect(kpiView(figures[FIGURE_ID.noShows], "en", routes).href).toBe(routes.today());
  });

  it("dates its freshness: stale after the figure's own horizon", () => {
    const v = kpiView(figures[FIGURE_ID.invoiced], "en", routes);
    expect(v.freshness).toEqual({ lastRead: "2026-10-23T12:00:00.000Z", expectedAt: "2026-10-24T12:00:00.000Z" });
  });

  it("links every figure to the lexique words it uses, the accountant ones marked", () => {
    const v = kpiView(figures[FIGURE_ID.gstToRemit], "fr", routes);
    expect(v.lexicon.map((l) => l.id)).toEqual(["tpsTvq", "declarationPeriod"]);
    expect(v.lexicon.every((l) => l.accountant)).toBe(true);
    expect(kpiView(figures[FIGURE_ID.invoiced], "fr", routes).lexicon.map((l) => l.accountant)).toEqual([false]);
  });

  it("says « nothing to judge yet » for a figure with no data, never « on track »", () => {
    const empty = computeFigures({ ...INPUT, invoices: [], payments: [], expenses: [], appointments: [] }, DEFAULT_FIGURE_THRESHOLDS);
    const v = kpiView(empty[FIGURE_ID.collected], "en", routes);
    expect(v.state).toBe("ok");
    expect(v.stateWords.ok).toBe(en.console.figures.state.info);
  });

  it("has every message of every figure, term and lexique word, in French and in English", () => {
    for (const lang of [en, fr]) {
      for (const id of Object.values(FIGURE_ID)) expect(Object.keys(lang.console.figures[id]).sort(), id).toEqual(["formula", "meaning", "name"]);
      for (const { id } of LEXICON) expect(lang.console.lexicon.terms[id].definition.length, id).toBeGreaterThan(10);
      for (const f of figures ? Object.values(figures) : []) for (const t of f.formula) expect(lang.console.figures.terms, t.label).toHaveProperty(t.label);
    }
  });

  it("never promises to file: the lead and the actions say the owner files", () => {
    for (const lang of [en, fr]) {
      expect(JSON.stringify(lang.console.figures)).not.toMatch(/\b(we file|we send|sent to Revenu|nous produisons|nous transmettons|transmise)\b/i);
    }
    expect(en.console.figures.never).toMatch(/you file/i);
    expect(fr.console.figures.never).toMatch(/vous produisez/i);
  });
});

describe("« que faire maintenant » is built from data and leads somewhere (#260)", () => {
  const actions = nextActions({ figures: INPUT, returnPrepared: false, slots: [{ weekday: 2, startsAt: "09:00", offered: 8, booked: 1 }] }, DEFAULT_FIGURE_THRESHOLDS, ["chase", "taxes", "slot"]);

  it("chases the overdue invoice with its number, days and amount, and opens it", () => {
    const chase = actionView(actions.find((a) => a.kind === "chase")!, "en", routes);
    expect(chase.title).toBe("Chase invoice F-0001");
    expect(chase.why).toBe("It is 13 days overdue and $64.98 is still owed.");
    expect(chase.href).toBe(routes.invoice("inv-a"));
    expect(chase.urgency).toBe("high");
  });

  it("prepares the return — never files it — and opens the books of the period", () => {
    const soon = nextActions({ figures: { ...INPUT, today: "2026-12-20" }, returnPrepared: false, slots: [] }, DEFAULT_FIGURE_THRESHOLDS, ["taxes"])[0]!;
    const view = actionView(soon, "en", routes);
    expect(view.title).toBe("Prepare your GST/QST return");
    expect(view.why).toContain("you file the return yourself");
    expect(view.href).toBe(routes.books("2026-Q4"));
    expect(periodId("2026-10-01")).toBe("2026-Q4");
  });

  it("names the weekday of an often-empty slot in the owner's language", () => {
    const slot = actionView(actions.find((a) => a.kind === "slot")!, "fr", routes);
    expect(slot.title).toBe("Ouvrir le mardi 09:00 aux réservations");
    expect(slot.why).toBe("Seulement 1 de ces 8 plages ont été réservées récemment.");
    expect(slot.href).toBe(routes.team);
  });

  it("builds nothing for a shop with no rows", () => {
    expect(nextActions({ figures: { ...INPUT, invoices: [] }, returnPrepared: false, slots: [] }, DEFAULT_FIGURE_THRESHOLDS, ["chase", "slot"])).toEqual([]);
  });
});
