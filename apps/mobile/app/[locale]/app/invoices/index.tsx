import * as React from "react";

import { LegacyRedirect } from "@/ui/LegacyRedirect";

/** The address before D8 (`/fr/app/invoices`): the shop's own invoices. */
export default function Legacy() {
  return <LegacyRedirect from="invoices" />;
}
