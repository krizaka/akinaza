import type { BookingPreselect } from "@akinaza/core";

/** One value of a query string (the first when it repeats), or null. */
export const searchValue = (value: string | string[] | undefined): string | null => (Array.isArray(value) ? value[0] : value) ?? null;

/** What the booking form starts with: the visitor's choice from the shop page (service, area, time) where the shop offers it, else the first of each. A lone dog is already chosen. */
export function bookingDefaults(input: { services: readonly { id: string }[]; zones: readonly { id: string }[]; dogs: readonly { id: string }[]; preselect: BookingPreselect }) {
  const { services, zones, dogs, preselect } = input;
  return {
    serviceId: preselect.serviceId ?? services[0]?.id ?? "",
    zoneId: preselect.zoneId ?? zones[0]?.id ?? "",
    dogIds: dogs.length === 1 ? [dogs[0]!.id] : ([] as string[]),
    startsAt: preselect.startsAt ?? "",
  };
}
