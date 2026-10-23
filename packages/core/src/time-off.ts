import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/**
 * Time off as date ranges (« vacances du 20 au 27 », akinaza#208), stored as days so every rule that reads `days_off`
 * (slots, the opening status, the Monday brief) keeps working. Dates are the shop's calendar days, `yyyy-MM-dd`.
 */
export const TIME_OFF_RULES = { maxDays: 92 } as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const iso = (day: Date) => format(day, "yyyy-MM-dd");

export interface TimeOffRange {
  from: string;
  to: string;
}

/** Every day of a range, both ends included; refused when reversed, malformed or longer than the rule allows. */
export function timeOffDays(range: TimeOffRange, rules = TIME_OFF_RULES): string[] {
  if (!DAY.test(range.from) || !DAY.test(range.to)) throw new RangeError("AK_TIME_OFF_DATE");
  const [start, end] = [parseISO(range.from), parseISO(range.to)];
  const length = differenceInCalendarDays(end, start) + 1;
  if (length < 1) throw new RangeError("AK_TIME_OFF_ORDER");
  if (length > rules.maxDays) throw new RangeError("AK_TIME_OFF_TOO_LONG");
  return Array.from({ length }, (_, i) => iso(addDays(start, i)));
}

/** Days back into ranges: consecutive days join, in order (duplicates collapse). */
export function timeOffRanges(days: readonly string[]): TimeOffRange[] {
  const ranges: TimeOffRange[] = [];
  for (const day of [...new Set(days)].sort()) {
    const last = ranges.at(-1);
    if (last && differenceInCalendarDays(parseISO(day), parseISO(last.to)) === 1) last.to = day;
    else ranges.push({ from: day, to: day });
  }
  return ranges;
}
