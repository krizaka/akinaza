import { listSlots, type PublicShop } from "@akinaza/db";
import type { BookingTime } from "@krizaka/ui/shop/booking";

import { nextFreeTime } from "./closing-call";
import { db } from "./db";
import type { Locale } from "./i18n";
import { resolveChoice, timesStep } from "./journey";
import { resolveSelection } from "./storefront";

/**
 * Reads the availability once on the server for the closing call: the page's own service and zone (as the booking link
 * does), the next two weeks, the first free time. Nothing is asked of the browser. A shop with no offer or no staff yet has none.
 */
export async function nextFreeTimeOf(input: { page: PublicShop; locale: Locale; now: Date }): Promise<BookingTime | undefined> {
  const { page, locale, now } = input;
  const { serviceId, zoneId } = resolveSelection(page, {});
  if (!serviceId) return undefined;
  try {
    const choice = resolveChoice(page, { zone: zoneId });
    const slots = await listSlots(db(), { shopId: page.shop.id, serviceId, zoneId: choice.zoneId, staffId: choice.staffId, now, days: 14 });
    return nextFreeTime(timesStep({ page, locale, now, serviceId, staffId: choice.staffId, zoneId: choice.zoneId, slots })?.days ?? []);
  } catch {
    return undefined;
  }
}
