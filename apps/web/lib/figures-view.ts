import { type Figure, FIGURE_STATE, type FigureId, type FigureState, type FormulaTerm, LEXICON, type LexiconId, type NextAction, staleAt, type Unit } from "@akinaza/core";

import { type FormatLocale,formatMoney, INTL_LOCALE } from "./format";
import { format, getDictionary, type Locale } from "./i18n";
import type { ShopRoutes } from "./routes";

type FiguresMessages = ReturnType<typeof getDictionary>["console"]["figures"];

/** The state words of `KpiExplained` (`ok | watch | act`) for the domain's states (`good | watch | alert | info`). */
export const KPI_STATE = { good: "ok", watch: "watch", alert: "act", info: "ok" } as const satisfies Record<FigureState, "ok" | "watch" | "act">;

/**
 * `KpiExplained` derives its state from the value and thresholds in the value's own units, but the domain judges a figure by its **rate**
 * (the overdue share of what is to collect, the margin rate…), against thresholds the administrator set in percent. The block is given
 * thresholds that reproduce the domain's verdict on the value shown, so the screen and the domain never disagree.
 */
export function kpiThresholds(state: FigureState, value: number): { direction: "above"; watchAt: number; actAt: number } {
  switch (state) {
    case FIGURE_STATE.alert:
      return { direction: "above", watchAt: value - 1, actAt: value };
    case FIGURE_STATE.watch:
      return { direction: "above", watchAt: value, actAt: value + 1 };
    default:
      return { direction: "above", watchAt: value + 1, actAt: value + 2 };
  }
}

const unitText = (value: number, unit: Unit, locale: FormatLocale) => {
  if (unit === "cents") return formatMoney(value, locale);
  return unit === "percent" ? `${value} %` : String(value);
};

/** « Total of your invoices before taxes, minus your credit notes. Here: Invoices before taxes $1,000.00 − Expenses for the business $200.00. » */
export function formulaText(figure: Figure, t: FiguresMessages, locale: FormatLocale): string {
  const label = (term: FormulaTerm) => t.terms[term.label as keyof typeof t.terms] ?? term.label;
  // A term with no operator after the first is a reading of the whole (« of which overdue »), not an addition.
  const terms = figure.formula.map((term, i) => termLead(i, term.op) + `${label(term)} ${unitText(term.value, term.unit, locale)}`).join(" ");
  return format(t.formulaHere, { formula: t[figure.id].formula, terms });
}

const RATE_ID = { collected: "collected", toCollect: "toCollect", margin: "margin", noShows: "noShows" } as const;

/** The meaning, then the second reading of the figure (its rate) when it has one. */
export function meaningText(figure: Figure, t: FiguresMessages): string {
  const base = t[figure.id].meaning;
  const rateKey = RATE_ID[figure.id as keyof typeof RATE_ID];
  return figure.rate !== null && rateKey ? `${base} ${format(t.rateOf[rateKey], { rate: figure.rate })}` : base;
}

/** Where the figure's rows can be opened. */
export function sourceHref(figure: Figure, routes: ShopRoutes): string {
  const first = figure.sources[0]?.kind;
  if (first === "appointment") return routes.today();
  if (first === "expense" || figure.id === "gstToRemit" || figure.id === "qstToRemit" || figure.id === "gstCollected" || figure.id === "qstCollected") return routes.books(figure.period ? periodId(figure.period.start) : undefined);
  return routes.invoices;
}

/** `2026-Q3` for the first day of a quarter (the address of the books page). */
export function periodId(start: string): string {
  return `${start.slice(0, 4)}-Q${Math.ceil(Number(start.slice(5, 7)) / 3)}`;
}

/** The sources as a sentence: « 12 invoices · 3 expenses » (a source with no row is left out). */
export function sourcesText(figure: Figure, t: FiguresMessages): string {
  return figure.sources.filter((s) => s.count > 0).map((s) => format(t.sources[s.kind], { count: s.count })).join(" · ") || "—";
}

export interface KpiView {
  id: FigureId;
  label: string;
  value: number;
  kind: "money" | "number";
  meaning: string;
  formula: string;
  sources: string;
  href: string;
  state: "ok" | "watch" | "act";
  /** The state word shown: « nothing to judge yet » for a figure with no data. */
  stateWords: Record<"ok" | "watch" | "act", string>;
  thresholds: ReturnType<typeof kpiThresholds>;
  freshness: { lastRead: string; expectedAt: string };
  lexicon: { id: LexiconId; term: string; definition: string; accountant: boolean }[];
}

/** Everything the screen needs of a figure, in the owner's language. Pure: the same figure gives the same view. */
export function kpiView(figure: Figure, locale: Locale, routes: ShopRoutes): KpiView {
  const t = getDictionary(locale).console.figures;
  const lexicon = getDictionary(locale).console.lexicon;
  const stateWords = { ok: t.state.good, watch: t.state.watch, act: t.state.alert };
  if (figure.state === FIGURE_STATE.info) stateWords.ok = t.state.info;
  return {
    id: figure.id,
    label: t[figure.id].name,
    value: figure.value,
    kind: figure.unit === "cents" ? "money" : "number",
    meaning: meaningText(figure, t),
    formula: formulaText(figure, t, locale),
    sources: sourcesText(figure, t),
    href: sourceHref(figure, routes),
    state: KPI_STATE[figure.state],
    stateWords,
    thresholds: kpiThresholds(figure.state, figure.value),
    freshness: { lastRead: figure.computedAt, expectedAt: staleAt(figure) },
    lexicon: figure.lexicon.map((id) => ({ id, term: lexicon.terms[id].term, definition: lexicon.terms[id].definition, accountant: LEXICON.find((x) => x.id === id)?.accountant ?? false })),
  };
}

export interface ActionView {
  id: string;
  title: string;
  why: string;
  urgency: "low" | "medium" | "high";
  urgencyLabel: string;
  cta: string;
  href: string;
}

/** The address an action leads to: its invoice, the list, the books of its period, or the shop's hours. */
function actionHref(target: NextAction["target"], routes: ShopRoutes): string {
  if (target.route === "invoice") return routes.invoice(target.invoiceId);
  if (target.route === "invoices") return routes.invoices;
  return target.route === "books" ? routes.books(periodId(target.period.start)) : routes.hours;
}

/** What goes before a term of a formula: nothing for the first, its operator, or a dot. */
function termLead(index: number, op: string | undefined): string {
  if (index === 0) return "";
  return op ? `${op} ` : "· ";
}

const URGENCY = { now: "high", soon: "medium", week: "low" } as const;

/** « What to do now »: the words of an action (catalogue messages with the action's variables) and the address it leads to. */
export function actionView(action: NextAction, locale: Locale, routes: ShopRoutes, shopLocale: FormatLocale = locale): ActionView {
  const t = getDictionary(locale).console.figures;
  const w = action.why;
  const money = (v: unknown) => formatMoney(Number(v), shopLocale);
  const href = actionHref(action.target, routes);
  const base = { id: `${action.kind}:${action.evidence[0] ?? ""}`, urgency: URGENCY[action.urgency], urgencyLabel: t.urgency[action.urgency], href };
  switch (action.kind) {
    case "chase": {
      const more = Number(w.others) > 0 ? ` ${format(t.actions.chase.more, { others: Number(w.others), total: money(w.totalCents) })}` : "";
      return { ...base, title: format(t.actions.chase.title, { number: String(w.number) }), why: `${format(t.actions.chase.why, { days: Number(w.days), amount: money(w.amountCents) })}${more}`, cta: t.actions.chase.cta };
    }
    case "taxes": {
      const days = Number(w.daysLeft);
      const past = action.urgency === "now";
      const range = { start: String(w.periodStart), end: String(w.periodEnd) };
      return { ...base, title: t.actions.taxes.title, why: past ? format(t.actions.taxes.whyPast, range) : format(t.actions.taxes.why, { days, ...range }), cta: t.actions.taxes.cta };
    }
    default: {
      // 2026-01-04 was a Sunday: the weekday number (0 = Sunday) is added to it to name the day in the owner's language.
      const day = new Date(Date.UTC(2026, 0, 4 + Number(w.weekday)));
      const weekday = day.toLocaleDateString(INTL_LOCALE[shopLocale], { weekday: "long", timeZone: "UTC" });
      return { ...base, title: format(t.actions.slot.title, { weekday, time: String(w.startsAt) }), why: format(t.actions.slot.why, { booked: Number(w.booked), offered: Number(w.offered) }), cta: t.actions.slot.cta };
    }
  }
}
