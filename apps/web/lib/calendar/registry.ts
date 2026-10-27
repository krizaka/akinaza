import type { CalendarKind, CalendarSource } from "@akinaza/core";

import { icsUrlSource } from "./ics-url-source";

/** The source of a connection, from its kind and its opened secret. `null` for a kind with no adapter yet (the provider adapters arrive behind their flags). */
export function sourceFor(kind: CalendarKind, secret: string, timezone: string): CalendarSource | null {
  if (kind === "ics") return icsUrlSource({ url: secret, timezone });
  return null;
}
