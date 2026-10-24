/** The calendar's month as the URL writes it (`2026-10`): its first and last day, and the next and previous ones. */
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonth = (value: string | undefined): value is string => !!value && MONTH.test(value);

export const monthOf = (day: string): string => day.slice(0, 7);

export function monthRange(month: string): { from: string; to: string } {
  const match = MONTH.exec(month);
  if (!match) throw new RangeError(`not a month: ${month}`);
  const year = Number(match[1]);
  const index = Number(match[2]);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, by: number): string {
  const { from } = monthRange(month);
  const date = new Date(`${from}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
}
