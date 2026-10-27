import type { FigureAnswer, NextActionAnswer } from "@akinaza/core";

import en from "../i18n/en.json";
import fr from "../i18n/fr.json";
import { actionText, formulaText, meaningText, sourcesText, toneOf, valueText } from "./figures";

const sayIn = (messages: typeof fr) => (key: string, vars: Record<string, string | number> = {}) => {
  const found = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
  if (typeof found !== "string") throw new Error(`no message ${key}`);
  return found.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name]));
};

const margin: FigureAnswer = {
  id: "margin", value: 80_000, unit: "cents", rate: 80,
  formula: [{ label: "invoicesSubtotal", value: 100_000, unit: "cents" }, { label: "expensesBusinessShare", value: 20_000, unit: "cents", op: "−" }],
  lexicon: ["margin"], sources: [{ kind: "invoice", ids: ["a"], count: 12 }, { kind: "expense", ids: [], count: 0 }], period: { start: "2026-07-01", end: "2026-09-30" },
  computedAt: "2026-10-20T12:00:00.000Z", cadence: "onChange", staleAfterHours: 24, state: "good",
};

describe("the figures on the phone (#168, #260)", () => {
  it("reads a value as dollars, a count or a percent", () => {
    expect(valueText({ value: 80_000, unit: "cents" }, "en")).toContain("800");
    expect(valueText({ value: 7, unit: "count" }, "fr")).toBe("7");
    expect(valueText({ value: 12, unit: "percent" }, "fr")).toBe("12 %");
  });

  it("explains the formula with its numbers, in both languages", () => {
    expect(formulaText(margin, sayIn(en), "en")).toMatch(/^Invoiced before taxes, minus your expenses.*Here: Invoices before taxes .*1,000.* − Expenses for the business .*200/s);
    expect(formulaText(margin, sayIn(fr), "fr")).toContain("Ici :");
  });

  it("adds the rate to the meaning and lists only the sources that have rows", () => {
    expect(meaningText(margin, sayIn(en))).toContain("80 %");
    expect(sourcesText(margin, sayIn(en))).toBe("12 invoices");
  });

  it("maps the state to a tone", () => {
    expect([toneOf("good"), toneOf("watch"), toneOf("alert"), toneOf("info")]).toEqual(["success", "warning", "danger", "neutral"]);
  });

  it("words each kind of action from its data, the return being prepared and never filed", () => {
    const chase: NextActionAnswer = { kind: "chase", urgency: "now", impactCents: 5_000, why: { number: "F-12", days: 9, amountCents: 5_000, others: 1, totalCents: 8_000 }, target: { route: "invoice" }, evidence: [] };
    const taxes: NextActionAnswer = { kind: "taxes", urgency: "soon", impactCents: 0, why: { daysLeft: 6, periodStart: "2026-07-01", periodEnd: "2026-09-30" }, target: { route: "books" }, evidence: [] };
    const slot: NextActionAnswer = { kind: "slot", urgency: "week", impactCents: 0, why: { weekday: 2, startsAt: "10:00", booked: 1, offered: 8 }, target: { route: "hours" }, evidence: [] };
    expect(actionText(chase, sayIn(en), "en").title).toBe("Chase invoice F-12");
    expect(actionText(chase, sayIn(en), "en").why).toContain("1 other");
    expect(actionText(taxes, sayIn(fr), "fr").why).toContain("vous produisez");
    expect(actionText(slot, sayIn(en), "en").title).toContain("Tuesday");
  });

  it("has the same figure words in both languages", () => {
    expect(Object.keys(en.figures).sort()).toEqual(Object.keys(fr.figures).sort());
  });
});
