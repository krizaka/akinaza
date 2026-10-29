import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";

/** How often the shop files its GST/QST return (Revenu Québec): the period of a return is one month, one quarter or one year. */
export const FILING = { monthly: "monthly", quarterly: "quarterly", annual: "annual" } as const;
export type Filing = (typeof FILING)[keyof typeof FILING];

export interface Period {
  /** First and last day, `yyyy-MM-dd`. */
  start: string;
  end: string;
}

const day = (d: Date) => format(d, "yyyy-MM-dd");

/** How many calendar months a filing period spans. */
function monthsIn(filing: Filing): number {
  if (filing === FILING.monthly) return 1;
  return filing === FILING.quarterly ? 3 : 12;
}

/** The declaration period that contains `today` (the shop's calendar day): calendar months, quarters or years. */
export function declarationPeriod(today: string, filing: Filing): Period {
  const d = parseISO(today);
  const monthsPerPeriod = monthsIn(filing);
  const first = startOfMonth(new Date(d.getFullYear(), d.getMonth() - (d.getMonth() % monthsPerPeriod), 1));
  return { start: day(first), end: day(endOfMonth(addMonths(first, monthsPerPeriod - 1))) };
}

/** The period right before this one (its return may still be unfiled while the next one has begun). */
export function previousPeriod(period: Period, filing: Filing): Period {
  return declarationPeriod(day(addDays(parseISO(period.start), -1)), filing);
}

export const inPeriod = (date: string, period: Period) => date >= period.start && date <= period.end;
