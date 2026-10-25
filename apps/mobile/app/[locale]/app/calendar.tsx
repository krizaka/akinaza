import * as React from "react";

import { LegacyRedirect } from "@/ui/LegacyRedirect";

/** The address before D8 (`/fr/app/calendar`): the same place at the shop's own address. */
export default function Legacy() {
  return <LegacyRedirect from="calendar" />;
}
