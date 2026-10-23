import { differenceInCalendarDays, differenceInMilliseconds, hoursToMilliseconds, parseISO } from "date-fns";

import { INVOICE_STATE, invoiceState, remainingCents } from "../invoice-state";
import { balance, expenseEntries, invoiceEntries, type LedgerEntry } from "../ledger";
import { applyRate, type Cents } from "../money";
import { inPeriod, type Period } from "./period";
import { FIGURE_STATE, type FigureState, type FigureThresholds, judge } from "./thresholds";


/** What the figures read: one shop, one moment, already in the shop's calendar. The database layer builds it; nothing here reads a clock or a database. */
export interface FiguresInput {
  /** The shop's calendar day (`yyyy-MM-dd`) and the instant it was computed (ISO). */
  today: string;
  computedAt: string;
  /** The period the money figures cover (the current declaration period for the taxes, the same for revenue and margin). */
  period: Period;
  /** Every invoice of the shop, credit notes included (negative amounts), cancelled ones too: the ledger is the sum of them all. Amounts without tax in `subtotalCents`. */
  invoices: {
    id: string;
    number: string;
    issuedOn: string;
    dueOn: string | null;
    subtotalCents: Cents;
    gstCents: Cents;
    qstCents: Cents;
    totalCents: Cents;
    paidCents: Cents;
    isCredit: boolean;
    superseded: boolean;
  }[];
  payments: { id: string; invoiceId: string; amountCents: Cents; receivedOn: string }[];
  expenses: { id: string; supplier: string; paidOn: string; subtotalCents: Cents; gstCents: Cents; qstCents: Cents; businessSharePct: number }[];
  /** The appointments of the period, one row each: `done`, `noShow`, `cancelled`, or still `booked`. */
  appointments: { id: string; day: string; status: "booked" | "done" | "cancelled" | "noShow" }[];
}

export const FIGURE_ID = {
  invoiced: "invoiced",
  collected: "collected",
  toCollect: "toCollect",
  gstCollected: "gstCollected",
  qstCollected: "qstCollected",
  gstToRemit: "gstToRemit",
  qstToRemit: "qstToRemit",
  margin: "margin",
  appointments: "appointments",
  noShows: "noShows",
} as const;
export type FigureId = (typeof FIGURE_ID)[keyof typeof FIGURE_ID];

/** The terms of the owner's lexique (messages `console.lexicon.terms.<id>`); `accountant`: the meaning depends on the shop's situation, « à valider par votre comptable ». */
export const LEXICON = [
  { id: "tpsTvq", accountant: true },
  { id: "htTtc", accountant: false },
  { id: "margin", accountant: true },
  { id: "collectedVsInvoiced", accountant: false },
  { id: "declarationPeriod", accountant: true },
  { id: "noShow", accountant: false },
] as const;
export type LexiconId = (typeof LEXICON)[number]["id"];

export type Unit = "cents" | "count" | "percent";

/** One term of a formula: its label is a message (`console.figures.terms.<label>`), its value is what was read. */
export interface FormulaTerm {
  label: string;
  value: number;
  unit: Unit;
  /** How it joins the previous term. */
  op?: "+" | "−" | "×" | "÷";
}

export interface FigureSource {
  kind: "invoice" | "expense" | "payment" | "appointment";
  ids: string[];
  /** How many rows were read (`ids` may be cut at `MAX_SOURCE_IDS`). */
  count: number;
}
const SOURCE_KIND = { invoice: "invoice", expense: "expense" } as const;
const APPOINTMENT = { done: "done", noShow: "noShow" } as const;
// @fixed: a technical bound on the size of an answer (a screen lists a few, the count says the rest).
export const MAX_SOURCE_IDS = 200;

/** How often the figure is recomputed, and how old it may be before it is called stale. */
export const CADENCE = { onChange: "onChange", daily: "daily" } as const;
export type Cadence = (typeof CADENCE)[keyof typeof CADENCE];

export interface Figure {
  id: FigureId;
  /** The figure itself: cents, a count, or a whole percent (see `unit`). */
  value: number;
  unit: Unit;
  /** A second reading of the same figure, as a whole percent (the collected share, the margin rate, the no-show rate); null when it means nothing yet. */
  rate: number | null;
  /** The formula, as data: the catalogue explains it with `console.figures.<id>.formula`, the terms carry the numbers. */
  formula: FormulaTerm[];
  /** The lexique terms its explanation links to. */
  lexicon: LexiconId[];
  /** The rows behind the figure: the invoices, the ledger's invoices and expenses, the payments, the appointments. */
  sources: FigureSource[];
  period: Period | null;
  computedAt: string;
  cadence: Cadence;
  /** Older than this many hours it is stale (the screen says so). */
  staleAfterHours: number;
  state: FigureState;
}

const source = (kind: FigureSource["kind"], ids: readonly string[]): FigureSource => ({ kind, ids: ids.slice(0, MAX_SOURCE_IDS), count: ids.length });
const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

/** A whole percent of `part` over `whole`, rounded half up, in exact integer arithmetic; null when there is no whole. */
export function percent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  const n = BigInt(part) * 100n;
  const d = BigInt(Math.abs(whole));
  const sign = (part < 0) !== (whole < 0) ? -1n : 1n;
  const abs = n < 0n ? -n : n;
  return Number(sign * ((2n * abs + d) / (2n * d)));
}

/** Whether a computed figure is still fresh at `now` (ISO). */
export const isStale = (figure: Pick<Figure, "computedAt" | "staleAfterHours">, now: string) => differenceInMilliseconds(parseISO(now), parseISO(figure.computedAt)) > hoursToMilliseconds(figure.staleAfterHours);

/**
 * The owner's figures for a period, each with its meaning's formula as data, its sources and its state (#260). Money is integer cents; the taxes are
 * the ledger's own (`invoiceEntries`, `expenseEntries`, `balance`): the figures never recompute a rate. Pure.
 */
export function computeFigures(input: FiguresInput, thresholds: FigureThresholds): Record<FigureId, Figure> {
  const { period, invoices, payments, expenses, appointments } = input;
  const base = { period, computedAt: input.computedAt, cadence: CADENCE.onChange, staleAfterHours: 24 };

  // The ledger of the period: what the invoices collected (a credit note posts negative amounts), what the expenses give back.
  const issued = invoices.filter((i) => inPeriod(i.issuedOn, period));
  const paidExpenses = expenses.filter((e) => inPeriod(e.paidOn, period));
  const entries: LedgerEntry[] = [...issued.flatMap(invoiceEntries), ...paidExpenses.flatMap(expenseEntries)];
  const gst = balance(entries, "gst");
  const qst = balance(entries, "qst");
  const ledgerSources = [source("invoice", [...new Set(entries.filter((e) => e.source.kind === SOURCE_KIND.invoice).map((e) => e.source.id))]), source("expense", [...new Set(entries.filter((e) => e.source.kind === SOURCE_KIND.expense).map((e) => e.source.id))])];

  // Revenue: without tax, credit notes counted negative (so a cancelled invoice and its credit note cancel out).
  const invoicedCents = sum(issued.map((i) => i.subtotalCents));
  const periodPayments = payments.filter((p) => inPeriod(p.receivedOn, period));
  const collectedCents = sum(periodPayments.map((p) => p.amountCents));
  const collectedRate = percent(collectedCents, sum(issued.map((i) => i.totalCents)));

  // What is still owed, today, whatever the period.
  const standing = (i: FiguresInput["invoices"][number]) => ({ totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: i.isCredit, superseded: i.superseded });
  const open = invoices.map((i) => ({ i, owed: remainingCents(standing(i)), state: invoiceState(standing(i), input.today) })).filter((x) => x.owed > 0);
  const toCollectCents = sum(open.map((x) => x.owed));
  const overdue = open.filter((x) => x.state === INVOICE_STATE.overdue);
  const overdueCents = sum(overdue.map((x) => x.owed));
  const overdueRate = percent(overdueCents, toCollectCents);

  // Margin: the revenue without tax, minus the expenses without tax at the share used for the business.
  const spentCents = sum(paidExpenses.map((e) => applyRate(e.subtotalCents, { numerator: e.businessSharePct, denominator: 100 })));
  const marginCents = invoicedCents - spentCents;
  const marginRate = percent(marginCents, invoicedCents);

  // Appointments: those that happened, and the no-shows among what was due (done + no-show).
  const done = appointments.filter((a) => a.status === APPOINTMENT.done);
  const missed = appointments.filter((a) => a.status === APPOINTMENT.noShow);
  const noShowRate = percent(missed.length, done.length + missed.length);

  const TERMS: Record<FigureId, LexiconId[]> = {
    invoiced: ["htTtc"],
    collected: ["collectedVsInvoiced", "htTtc"],
    toCollect: ["collectedVsInvoiced"],
    gstCollected: ["tpsTvq"],
    qstCollected: ["tpsTvq"],
    gstToRemit: ["tpsTvq", "declarationPeriod"],
    qstToRemit: ["tpsTvq", "declarationPeriod"],
    margin: ["margin", "htTtc"],
    appointments: [],
    noShows: ["noShow"],
  };
  const figure = (id: FigureId, value: number, unit: Unit, rate: number | null, formula: FormulaTerm[], sources: FigureSource[], state: FigureState, extra: Partial<Figure> = {}): Figure => ({ id, value, unit, rate, formula, lexicon: TERMS[id], sources, state, ...base, ...extra });

  return {
    invoiced: figure(FIGURE_ID.invoiced, invoicedCents, "cents", null, [{ label: "invoicesSubtotal", value: invoicedCents, unit: "cents" }], [source("invoice", issued.map((i) => i.id))], issued.length ? FIGURE_STATE.good : FIGURE_STATE.info),
    collected: figure(
      FIGURE_ID.collected,
      collectedCents,
      "cents",
      collectedRate,
      [{ label: "paymentsReceived", value: collectedCents, unit: "cents" }, { label: "invoicedWithTaxes", value: sum(issued.map((i) => i.totalCents)), unit: "cents", op: "÷" }],
      [source("payment", periodPayments.map((p) => p.id))],
      judge(collectedRate, { watch: thresholds.collectedWatchPct, alert: thresholds.collectedAlertPct }, "higher"),
    ),
    toCollect: figure(
      FIGURE_ID.toCollect,
      toCollectCents,
      "cents",
      overdueRate,
      [{ label: "invoicesTotal", value: sum(open.map((x) => x.i.totalCents)), unit: "cents" }, { label: "paymentsReceived", value: sum(open.map((x) => x.i.paidCents)), unit: "cents", op: "−" }, { label: "overdue", value: overdueCents, unit: "cents" }],
      [source("invoice", open.map((x) => x.i.id))],
      judge(overdueRate, { watch: thresholds.overdueWatchPct, alert: thresholds.overdueAlertPct }, "lower"),
      { period: null },
    ),
    gstCollected: figure(FIGURE_ID.gstCollected, gst.collected, "cents", null, [{ label: "gstOnInvoices", value: gst.collected, unit: "cents" }], [ledgerSources[0]!], FIGURE_STATE.info),
    qstCollected: figure(FIGURE_ID.qstCollected, qst.collected, "cents", null, [{ label: "qstOnInvoices", value: qst.collected, unit: "cents" }], [ledgerSources[0]!], FIGURE_STATE.info),
    gstToRemit: figure(FIGURE_ID.gstToRemit, gst.net, "cents", null, [{ label: "gstOnInvoices", value: gst.collected, unit: "cents" }, { label: "gstOnExpenses", value: gst.credits, unit: "cents", op: "−" }], ledgerSources, FIGURE_STATE.info),
    qstToRemit: figure(FIGURE_ID.qstToRemit, qst.net, "cents", null, [{ label: "qstOnInvoices", value: qst.collected, unit: "cents" }, { label: "qstOnExpenses", value: qst.credits, unit: "cents", op: "−" }], ledgerSources, FIGURE_STATE.info),
    margin: figure(
      FIGURE_ID.margin,
      marginCents,
      "cents",
      marginRate,
      [{ label: "invoicesSubtotal", value: invoicedCents, unit: "cents" }, { label: "expensesBusinessShare", value: spentCents, unit: "cents", op: "−" }],
      [source("invoice", issued.map((i) => i.id)), source("expense", paidExpenses.map((e) => e.id))],
      judge(marginRate, { watch: thresholds.marginWatchPct, alert: thresholds.marginAlertPct }, "higher"),
    ),
    appointments: figure(FIGURE_ID.appointments, done.length, "count", null, [{ label: "appointmentsDone", value: done.length, unit: "count" }], [source("appointment", done.map((a) => a.id))], done.length ? FIGURE_STATE.good : FIGURE_STATE.info, { cadence: CADENCE.onChange }),
    noShows: figure(
      FIGURE_ID.noShows,
      missed.length,
      "count",
      noShowRate,
      [{ label: "appointmentsNoShow", value: missed.length, unit: "count" }, { label: "appointmentsDue", value: done.length + missed.length, unit: "count", op: "÷" }],
      [source("appointment", missed.map((a) => a.id))],
      judge(noShowRate, { watch: thresholds.noShowWatchPct, alert: thresholds.noShowAlertPct }, "lower"),
    ),
  };
}

/** The days an invoice is overdue at `today` (0 when it is not). */
export const daysOverdue = (dueOn: string | null, today: string) => (dueOn && dueOn < today ? differenceInCalendarDays(parseISO(today), parseISO(dueOn)) : 0);
