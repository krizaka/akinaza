import type { FigureAnswer, NextActionAnswer } from "@akinaza/core";

import type { Locale } from "./links";
import { dollars } from "./money";

/** The words the figures need from the catalogue (`figures.*` of the app's messages): the screen passes its `t`. */
export type Say = (key: string, vars?: Record<string, string | number>) => string;

const TONE = { good: "success", watch: "warning", alert: "danger", info: "neutral" } as const;
export type FigureTone = (typeof TONE)[keyof typeof TONE];
/** The badge tone of a figure's state: green on track, amber to watch, red to act on, grey when there is nothing to judge yet. */
export const toneOf = (state: FigureAnswer["state"]): FigureTone => TONE[state];

/** A figure's value as the owner reads it: dollars for cents, a plain count, a whole percent. */
export function valueText(figure: Pick<FigureAnswer, "value" | "unit">, locale: Locale): string {
  if (figure.unit === "cents") return dollars(figure.value, locale);
  return figure.unit === "percent" ? `${figure.value} %` : String(figure.value);
}

/** « Total of your invoices before taxes, minus your credit notes. Here: Invoices before taxes $1,000.00 − Expenses $200.00. » */
export function formulaText(figure: FigureAnswer, say: Say, locale: Locale): string {
  const terms = figure.formula
    .map((term, i) => {
      const label = say(`figures.terms.${term.label}`);
      const value = valueText(term, locale);
      return `${i === 0 ? "" : term.op ? `${term.op} ` : "· "}${label} ${value}`;
    })
    .join(" ");
  return say("figures.formulaHere", { formula: say(`figures.${figure.id}.formula`), terms });
}

const RATE_KEYS = ["collected", "toCollect", "margin", "noShows"];
/** The meaning, then the second reading of the figure (its rate) when it has one. */
export function meaningText(figure: FigureAnswer, say: Say): string {
  const base = say(`figures.${figure.id}.meaning`);
  return figure.rate !== null && RATE_KEYS.includes(figure.id) ? `${base} ${say(`figures.rateOf.${figure.id}`, { rate: figure.rate })}` : base;
}

/** « 12 invoices · 3 expenses » (a source with no row is left out). */
export function sourcesText(figure: FigureAnswer, say: Say): string {
  return figure.sources.filter((s) => s.count > 0).map((s) => say(`figures.sources.${s.kind}`, { count: s.count })).join(" · ") || "—";
}

/** « What to do now »: the words of an action, from the catalogue and the action's own variables. */
export function actionText(action: NextActionAnswer, say: Say, locale: Locale): { title: string; why: string } {
  const w = action.why;
  const money = (v: unknown) => dollars(Number(v), locale);
  if (action.kind === "chase") {
    const more = Number(w.others) > 0 ? ` ${say("figures.actions.chase.more", { others: Number(w.others), total: money(w.totalCents) })}` : "";
    return { title: say("figures.actions.chase.title", { number: String(w.number) }), why: `${say("figures.actions.chase.why", { days: Number(w.days), amount: money(w.amountCents) })}${more}` };
  }
  if (action.kind === "taxes") {
    const range = { start: String(w.periodStart), end: String(w.periodEnd) };
    return { title: say("figures.actions.taxes.title"), why: action.urgency === "now" ? say("figures.actions.taxes.whyPast", range) : say("figures.actions.taxes.why", { days: Number(w.daysLeft), ...range }) };
  }
  // 2026-01-04 was a Sunday: the weekday number (0 = Sunday) names the day in the owner's language.
  const weekday = new Date(Date.UTC(2026, 0, 4 + Number(w.weekday))).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { weekday: "long", timeZone: "UTC" });
  return { title: say("figures.actions.slot.title", { weekday, time: String(w.startsAt) }), why: say("figures.actions.slot.why", { booked: Number(w.booked), offered: Number(w.offered) }) };
}
