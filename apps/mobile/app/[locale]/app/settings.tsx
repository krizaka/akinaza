import * as React from "react";

import { LegacyRedirect } from "@/ui/LegacyRedirect";

/** The address before D8 (`/fr/app/settings`): the same place at the shop's own address. */
export default function Legacy() {
  return <LegacyRedirect from="settings" />;
}
