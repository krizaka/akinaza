/**
 * The thresholds the figures are judged against, and the actions offered (#260). Data, never constants in a screen: the administrator sets the
 * defaults (`figures.*` settings), the owner may tune them inside the administrator's bounds. Percentages are whole numbers.
 */
export interface FigureThresholds {
  /** Share of what is still to collect that is overdue (percent): above `watch` the figure asks for a look, above `alert` for action. */
  overdueWatchPct: number;
  overdueAlertPct: number;
  /** Share of what was invoiced in the period that was collected (percent): below `watch` / `alert`. */
  collectedWatchPct: number;
  collectedAlertPct: number;
  /** Margin over the revenue (percent): below `watch` / `alert`. */
  marginWatchPct: number;
  marginAlertPct: number;
  /** No-shows over the appointments that were due (percent): above `watch` / `alert`. */
  noShowWatchPct: number;
  noShowAlertPct: number;
  /** « Prepare the return » is offered when the declaration period ends within this many days (or ended and was not prepared). */
  taxPeriodSoonDays: number;
  /** A slot is « often empty » when at most this share of its offered occurrences were booked (percent)… */
  emptySlotMaxFillPct: number;
  /** …over at least this many occurrences. */
  emptySlotMinOffered: number;
  /** How many actions « what to do now » shows at most. */
  maxActions: number;
}

export const DEFAULT_FIGURE_THRESHOLDS: FigureThresholds = {
  overdueWatchPct: 10,
  overdueAlertPct: 25,
  collectedWatchPct: 80,
  collectedAlertPct: 60,
  marginWatchPct: 30,
  marginAlertPct: 15,
  noShowWatchPct: 5,
  noShowAlertPct: 10,
  taxPeriodSoonDays: 14,
  emptySlotMaxFillPct: 25,
  emptySlotMinOffered: 4,
  maxActions: 3,
};

/** The kinds of action « what to do now » can offer; the administrator chooses which are on. */
export const ACTION_KIND = { chase: "chase", taxes: "taxes", slot: "slot" } as const;
export type ActionKind = (typeof ACTION_KIND)[keyof typeof ACTION_KIND];
export const ACTION_KINDS: readonly ActionKind[] = [ACTION_KIND.chase, ACTION_KIND.taxes, ACTION_KIND.slot];

/** A figure's state against its thresholds: `info` when there is nothing to judge (no data yet). */
export const FIGURE_STATE = { good: "good", watch: "watch", alert: "alert", info: "info" } as const;
export type FigureState = (typeof FIGURE_STATE)[keyof typeof FIGURE_STATE];

/** `higher` is better (collected share, margin) or `lower` is better (overdue share, no-shows). */
export function judge(value: number | null, bounds: { watch: number; alert: number }, better: "higher" | "lower"): FigureState {
  if (value === null) return FIGURE_STATE.info;
  if (better === "higher") return value < bounds.alert ? FIGURE_STATE.alert : value < bounds.watch ? FIGURE_STATE.watch : FIGURE_STATE.good;
  return value > bounds.alert ? FIGURE_STATE.alert : value > bounds.watch ? FIGURE_STATE.watch : FIGURE_STATE.good;
}

const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * A configuration that cannot contradict itself: percentages stay within 0-100, and the « alert » bound is never gentler than the « watch » one
 * (a shop cannot be in alert at 70 % collected and fine at 60 %).
 */
export function sanitizeThresholds(t: FigureThresholds): FigureThresholds {
  const lowerBetter = (watch: number, alert: number) => ({ watch: clampPct(watch), alert: Math.max(clampPct(alert), clampPct(watch)) });
  const higherBetter = (watch: number, alert: number) => ({ watch: clampPct(watch), alert: Math.min(clampPct(alert), clampPct(watch)) });
  const overdue = lowerBetter(t.overdueWatchPct, t.overdueAlertPct);
  const noShow = lowerBetter(t.noShowWatchPct, t.noShowAlertPct);
  const collected = higherBetter(t.collectedWatchPct, t.collectedAlertPct);
  const margin = higherBetter(t.marginWatchPct, t.marginAlertPct);
  return {
    ...t,
    overdueWatchPct: overdue.watch,
    overdueAlertPct: overdue.alert,
    noShowWatchPct: noShow.watch,
    noShowAlertPct: noShow.alert,
    collectedWatchPct: collected.watch,
    collectedAlertPct: collected.alert,
    marginWatchPct: margin.watch,
    marginAlertPct: margin.alert,
    emptySlotMaxFillPct: clampPct(t.emptySlotMaxFillPct),
    emptySlotMinOffered: Math.max(1, Math.round(t.emptySlotMinOffered)),
    taxPeriodSoonDays: Math.max(0, Math.round(t.taxPeriodSoonDays)),
    maxActions: Math.max(0, Math.round(t.maxActions)),
  };
}
