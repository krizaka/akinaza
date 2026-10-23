import { describe, expect, it } from "vitest";

import { balance, expenseEntries, invoiceEntries } from "../ledger";
import { computeFigures, FIGURE_ID, isStale, LEXICON, MAX_SOURCE_IDS, percent } from "./figures";
import { declarationPeriod, FILING, previousPeriod } from "./period";
import { input, PERIOD } from "./fixtures";
import { DEFAULT_FIGURE_THRESHOLDS, FIGURE_STATE, judge, sanitizeThresholds } from "./thresholds";

const figures = (over = {}) => computeFigures(input(over), DEFAULT_FIGURE_THRESHOLDS);

describe("each figure, from known invoices (integer cents, the ledger's own rules)", () => {
  it("revenue invoiced is the subtotals without tax, a credit note cancelling the invoice it replaces", () => {
    const f = figures().invoiced;
    expect(f.value).toBe(30_000); // 10 000 + 20 000 + 5 000 − 5 000
    expect(f.sources).toEqual([{ kind: "invoice", ids: ["inv-a", "inv-b", "inv-x", "inv-cn"], count: 4 }]);
    expect(f.formula).toEqual([{ label: "invoicesSubtotal", value: 30_000, unit: "cents" }]);
  });

  it("revenue collected is the payments received in the period, and its share of what was invoiced with taxes", () => {
    const f = figures().collected;
    expect(f.value).toBe(27_995); // 5 000 + 22 995
    expect(f.rate).toBe(81); // 27 995 / 34 493 (11 498 + 22 995 + 5 749 − 5 749)
    expect(f.state).toBe(FIGURE_STATE.good);
    expect(f.sources).toEqual([{ kind: "payment", ids: ["pay-a", "pay-b"], count: 2 }]);
  });

  it("invoices to collect is what is still owed today, with the overdue part, and ignores credit notes and cancelled invoices", () => {
    const f = figures().toCollect;
    expect(f.value).toBe(6_498); // 11 498 − 5 000, nothing on the paid, cancelled or credit one
    expect(f.rate).toBe(100); // all of it overdue (due 2026-10-10)
    expect(f.state).toBe(FIGURE_STATE.alert);
    expect(f.formula.map((t) => t.label)).toEqual(["invoicesTotal", "paymentsReceived", "overdue"]);
    expect(f.sources[0]!.ids).toEqual(["inv-a"]);
    expect(f.period).toBeNull();
  });

  it("GST and QST collected and to remit are the ledger's balance of the period: collected − credits of the expenses, shared use applied", () => {
    const f = figures();
    expect(f.gstCollected.value).toBe(1_500); // 500 + 1 000 + 250 − 250
    expect(f.qstCollected.value).toBe(2_993); // 998 + 1 995 + 499 − 499
    expect(f.gstToRemit.value).toBe(1_000); // 1 500 − (400 + 100)
    expect(f.qstToRemit.value).toBe(1_995); // 2 993 − (798 + 200)
    expect(f.gstToRemit.formula).toEqual([{ label: "gstOnInvoices", value: 1_500, unit: "cents" }, { label: "gstOnExpenses", value: 500, unit: "cents", op: "−" }]);
    expect(f.gstToRemit.sources).toEqual([
      { kind: "invoice", ids: ["inv-a", "inv-b", "inv-x", "inv-cn"], count: 4 },
      { kind: "expense", ids: ["exp-1", "exp-2"], count: 2 },
    ]);
  });

  it("agrees, to the cent, with the ledger functions it is built on", () => {
    const i = input();
    const entries = [...i.invoices.filter((x) => x.issuedOn >= PERIOD.start).flatMap(invoiceEntries), ...i.expenses.filter((e) => e.paidOn >= PERIOD.start).flatMap(expenseEntries)];
    const f = figures();
    expect(f.gstToRemit.value).toBe(balance(entries, "gst").net);
    expect(f.qstToRemit.value).toBe(balance(entries, "qst").net);
  });

  it("margin is the revenue without tax minus the expenses without tax at the business share, and its rate", () => {
    const f = figures().margin;
    expect(f.value).toBe(20_000); // 30 000 − (8 000 + 2 000)
    expect(f.rate).toBe(67); // 66.67 → 67
    expect(f.state).toBe(FIGURE_STATE.good);
    expect(f.sources.map((s) => s.kind)).toEqual(["invoice", "expense"]);
    expect(f.sources[1]!.ids).toEqual(["exp-1", "exp-2"]); // last year's expense is outside the period
  });

  it("appointments are those done; no-shows are counted over what was due (done + no-show), not cancelled or upcoming ones", () => {
    const f = figures();
    expect(f.appointments.value).toBe(8);
    expect(f.noShows.value).toBe(1);
    expect(f.noShows.rate).toBe(11); // 1 / 9
    expect(f.noShows.state).toBe(FIGURE_STATE.alert); // above 10 %
    expect(f.noShows.sources).toEqual([{ kind: "appointment", ids: ["ap-ns"], count: 1 }]);
  });

  it("has no state to judge without data: info, never a made-up green", () => {
    const f = figures({ invoices: [], payments: [], expenses: [], appointments: [] });
    expect(f.invoiced.state).toBe(FIGURE_STATE.info);
    for (const id of [FIGURE_ID.collected, FIGURE_ID.toCollect, FIGURE_ID.margin, FIGURE_ID.noShows, FIGURE_ID.appointments]) expect(f[id].state, id).toBe(FIGURE_STATE.info);
    expect(f.margin.rate).toBeNull();
    expect(f.gstToRemit.value).toBe(0);
  });

  it("judges against thresholds that are data: a stricter shop gets a different state from the same numbers", () => {
    const strict = computeFigures(input(), { ...DEFAULT_FIGURE_THRESHOLDS, collectedWatchPct: 90, marginWatchPct: 80 });
    expect(strict.collected.state).toBe(FIGURE_STATE.watch);
    expect(strict.margin.state).toBe(FIGURE_STATE.watch);
  });

  it("says when it was computed and when that is stale", () => {
    const f = figures().margin;
    expect(f.computedAt).toBe("2026-10-23T12:00:00.000Z");
    expect(isStale(f, "2026-10-24T11:00:00.000Z")).toBe(false);
    expect(isStale(f, "2026-10-24T13:00:00.000Z")).toBe(true);
  });

  it("cuts the source ids of a huge period, and says how many rows there were", () => {
    const many = Array.from({ length: MAX_SOURCE_IDS + 50 }, (_, i) => ({ id: `i${i}`, number: `F${i}`, issuedOn: "2026-10-05", dueOn: null, subtotalCents: 100, gstCents: 5, qstCents: 10, totalCents: 115, paidCents: 115, isCredit: false, superseded: false }));
    const f = figures({ invoices: many }).invoiced;
    expect(f.sources[0]!.ids).toHaveLength(MAX_SOURCE_IDS);
    expect(f.sources[0]!.count).toBe(MAX_SOURCE_IDS + 50);
    expect(f.value).toBe(100 * (MAX_SOURCE_IDS + 50));
  });
});

describe("the lexique each figure points to", () => {
  it("links every figure to its terms, and every term exists once, the ones that need an accountant marked", () => {
    const f = figures();
    expect(f.gstToRemit.lexicon).toEqual(["tpsTvq", "declarationPeriod"]);
    expect(f.noShows.lexicon).toEqual(["noShow"]);
    expect(f.collected.lexicon).toEqual(["collectedVsInvoiced", "htTtc"]);
    const known = new Set(LEXICON.map((t) => t.id));
    expect(known.size).toBe(LEXICON.length);
    for (const figure of Object.values(f)) for (const id of figure.lexicon) expect(known.has(id), id).toBe(true);
    expect(LEXICON.filter((t) => t.accountant).map((t) => t.id).sort()).toEqual(["declarationPeriod", "margin", "tpsTvq"]);
  });
});

describe("percent and judge", () => {
  it("rounds half up in integers, keeps the sign, and is null without a whole", () => {
    expect(percent(1, 8)).toBe(13); // 12.5
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(-1, 3)).toBe(-33);
    expect(percent(5, 0)).toBeNull();
  });
  it("judges in both directions, edges included", () => {
    expect(judge(80, { watch: 80, alert: 60 }, "higher")).toBe("good");
    expect(judge(79, { watch: 80, alert: 60 }, "higher")).toBe("watch");
    expect(judge(59, { watch: 80, alert: 60 }, "higher")).toBe("alert");
    expect(judge(10, { watch: 10, alert: 25 }, "lower")).toBe("good");
    expect(judge(11, { watch: 10, alert: 25 }, "lower")).toBe("watch");
    expect(judge(26, { watch: 10, alert: 25 }, "lower")).toBe("alert");
    expect(judge(null, { watch: 1, alert: 2 }, "lower")).toBe("info");
  });
});

describe("the thresholds cannot contradict themselves", () => {
  it("keeps the defaults as they are, and orders alert behind watch", () => {
    expect(sanitizeThresholds(DEFAULT_FIGURE_THRESHOLDS)).toEqual(DEFAULT_FIGURE_THRESHOLDS);
    const odd = sanitizeThresholds({ ...DEFAULT_FIGURE_THRESHOLDS, collectedWatchPct: 50, collectedAlertPct: 70, overdueWatchPct: 40, overdueAlertPct: 5, marginWatchPct: 140, noShowAlertPct: -3 });
    expect(odd).toMatchObject({ collectedWatchPct: 50, collectedAlertPct: 50, overdueWatchPct: 40, overdueAlertPct: 40, marginWatchPct: 100, noShowAlertPct: 5 });
  });
});

describe("the declaration period", () => {
  it("is the month, quarter or year that contains the day", () => {
    expect(declarationPeriod("2026-10-23", FILING.monthly)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(declarationPeriod("2026-10-23", FILING.quarterly)).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(declarationPeriod("2026-02-10", FILING.quarterly)).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(declarationPeriod("2026-05-01", FILING.quarterly)).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    expect(declarationPeriod("2026-10-23", FILING.annual)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(declarationPeriod("2028-02-29", FILING.monthly)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
  it("has a previous one", () => {
    expect(previousPeriod({ start: "2026-10-01", end: "2026-12-31" }, FILING.quarterly)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(previousPeriod({ start: "2026-01-01", end: "2026-01-31" }, FILING.monthly)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });
});

