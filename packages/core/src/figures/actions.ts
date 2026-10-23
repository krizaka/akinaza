import { differenceInCalendarDays, parseISO } from "date-fns";

import { INVOICE_STATE, invoiceState, remainingCents } from "../invoice-state";
import type { Cents } from "../money";
import { daysOverdue, type FiguresInput } from "./figures";
import type { Period } from "./period";
import { ACTION_KIND, type ActionKind, type FigureThresholds } from "./thresholds";

/** Where an action leads: the app maps each to its address (`shopRoutes`); the domain only says which place and which record. */
export type ActionTarget = { route: "invoice"; invoiceId: string } | { route: "invoices" } | { route: "books"; period: Period } | { route: "hours" };

/** The words of an action are catalogue messages (`console.figures.actions.<kind>.title|why`) with these variables: nothing is composed here. */
export interface NextAction {
  kind: ActionKind;
  /** How soon: `now` (overdue money, a return past its period), `soon` (a period ending), `week` (a slot to fill). */
  urgency: "now" | "soon" | "week";
  /** What is at stake, in cents (0 when it is not money). */
  impactCents: Cents;
  why: Record<string, string | number>;
  target: ActionTarget;
  /** The rows the action comes from (an invoice id, a weekday): the proof it was built from data. */
  evidence: string[];
}

export interface ActionsInput {
  figures: Pick<FiguresInput, "today" | "invoices" | "period">;
  /** The shop's declaration period that contains today, and whether its return was already prepared. */
  returnPrepared: boolean;
  /** How often each recurring slot (a weekday and a start time) was offered and booked over the look-back window. */
  slots: { weekday: number; startsAt: string; offered: number; booked: number }[];
}

const URGENCY = { now: 0, soon: 1, week: 2 } as const;

/**
 * « Que faire maintenant »: a few ranked actions, each from real data and each with its why and its target (#260). Nothing is invented: an empty
 * shop gets none. The return is prepared, never filed (AGENTS section 2). Only the kinds the administrator offers are considered.
 */
export function nextActions(input: ActionsInput, thresholds: FigureThresholds, offered: readonly ActionKind[]): NextAction[] {
  const { today, invoices, period } = input.figures;
  const actions: NextAction[] = [];
  const on = (k: ActionKind) => offered.includes(k);

  if (on(ACTION_KIND.chase)) {
    const overdue = invoices
      .map((i) => ({ i, owed: remainingCents({ totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: i.isCredit, superseded: i.superseded }), state: invoiceState({ totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: i.isCredit, superseded: i.superseded }, today) }))
      .filter((x) => x.state === INVOICE_STATE.overdue && x.owed > 0)
      .sort((a, b) => b.owed - a.owed || (a.i.dueOn ?? "").localeCompare(b.i.dueOn ?? ""));
    const first = overdue[0];
    if (first) {
      actions.push({
        kind: ACTION_KIND.chase,
        urgency: "now",
        impactCents: overdue.reduce((s, x) => s + x.owed, 0),
        why: { number: first.i.number, days: daysOverdue(first.i.dueOn, today), amountCents: first.owed, others: overdue.length - 1, totalCents: overdue.reduce((s, x) => s + x.owed, 0) },
        target: { route: "invoice", invoiceId: first.i.id },
        evidence: overdue.map((x) => x.i.id),
      });
    }
  }

  if (on(ACTION_KIND.taxes) && !input.returnPrepared) {
    const daysLeft = differenceInCalendarDays(parseISO(period.end), parseISO(today));
    if (daysLeft <= thresholds.taxPeriodSoonDays) {
      actions.push({
        kind: ACTION_KIND.taxes,
        urgency: daysLeft < 0 ? "now" : "soon",
        impactCents: 0,
        why: { daysLeft: Math.max(0, daysLeft), periodStart: period.start, periodEnd: period.end },
        target: { route: "books", period },
        evidence: [`period:${period.start}`],
      });
    }
  }

  if (on(ACTION_KIND.slot)) {
    const empty = input.slots
      .filter((s) => s.offered >= thresholds.emptySlotMinOffered && s.booked * 100 <= s.offered * thresholds.emptySlotMaxFillPct)
      .sort((a, b) => a.booked / a.offered - b.booked / b.offered || b.offered - a.offered)[0];
    if (empty) {
      actions.push({
        kind: ACTION_KIND.slot,
        urgency: "week",
        impactCents: 0,
        why: { weekday: empty.weekday, startsAt: empty.startsAt, booked: empty.booked, offered: empty.offered },
        target: { route: "hours" },
        evidence: [`slot:${empty.weekday}:${empty.startsAt}`],
      });
    }
  }

  return actions.sort((a, b) => URGENCY[a.urgency] - URGENCY[b.urgency] || b.impactCents - a.impactCents).slice(0, Math.max(0, thresholds.maxActions));
}
