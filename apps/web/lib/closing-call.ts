import type { BookingTime } from "@krizaka/ui/shop/booking";

import type { DayView } from "./storefront";

/**
 * The closing call's « next free time » (akinaza#480): the first free time of the first day that has one. A day with nothing
 * free (a closed day included) is skipped, so on a closed day the call shows the next opening's time, in words
 * (« Tomorrow 9:00 »). None free: undefined, and the call is its title and its action alone. Pure.
 */
export function nextFreeTime(days: readonly DayView[]): BookingTime | undefined {
  for (const day of days) {
    const slot = day.slots[0];
    if (slot) return { id: slot.id, label: `${day.label} ${slot.label}`, href: slot.href };
  }
  return undefined;
}
