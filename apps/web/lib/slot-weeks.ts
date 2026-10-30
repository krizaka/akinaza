import { shiftDay } from "./day";

/** The parts of a day the booking pages group the times by (`SlotPicker` groups): before noon, until 17 h, then the evening. */
export const DAY_PARTS = ["morning", "afternoon", "evening"] as const;
export type DayPart = (typeof DAY_PARTS)[number];

export const partOfHour = (hour: number): DayPart => {
  if (hour < 12) return "morning";
  return hour < 17 ? "afternoon" : "evening";
};

/** The hour (0–23) of an instant on the shop's clock. */
export function hourIn(instant: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone }).formatToParts(instant).find((p) => p.type === "hour")?.value;
  return Number(hour ?? 0) % 24;
}

/** The Monday (ISO day) of the week a day (ISO) is in: `SlotPicker`'s weeks start on a Monday. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDay(day, -((weekday + 6) % 7));
}

/** The days (ISO) a week (its Monday) holds. */
export const weekDays = (monday: string): string[] => Array.from({ length: 7 }, (_, n) => shiftDay(monday, n));

/** Groups the times of a day by part, the empty parts left out; the order of the times is kept. */
export function groupByPart<T>(items: readonly T[], hourOf: (item: T) => number): { part: DayPart; items: T[] }[] {
  return DAY_PARTS.map((part) => ({ part, items: items.filter((item) => partOfHour(hourOf(item)) === part) })).filter((g) => g.items.length > 0);
}
