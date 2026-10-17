import type { Hours } from "@akinaza/core";

/** The opening hours as a few readable lines: days with the same hours are grouped (« Mon–Fri 09:00–17:00 »). */
export function hoursLines(hours: Hours, locale: "en" | "fr"): string[] {
  // 2026-10-18 is a Sunday: day 0.
  const name = (weekday: number) => new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 18 + weekday)));
  const key = (w: number) => (hours[w] ?? []).map((r) => `${r.startsAt}–${r.endsAt}`).join(", ");
  const order = [1, 2, 3, 4, 5, 6, 0].filter((w) => key(w) !== "");
  const lines: string[] = [];
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && key(order[j + 1]!) === key(order[i]!) && order[j + 1] === (order[j]! + 1) % 7) j += 1;
    const first = name(order[i]!);
    lines.push(`${j > i ? `${first}–${name(order[j]!)}` : first} ${key(order[i]!)}`);
    i = j + 1;
  }
  return lines;
}

/** A synced value as text for the diff: the hours in lines, a string as it is, nothing as `null`. */
export function valueLines(field: string, value: unknown, locale: "en" | "fr"): string[] | null {
  if (field === "hours") {
    const lines = hoursLines((value ?? {}) as Hours, locale);
    return lines.length ? lines : null;
  }
  return typeof value === "string" && value.trim() ? [value] : null;
}
