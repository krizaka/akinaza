import { documentFromLegacy } from "@akinaza/core";

import type { Locale } from "@/lib/i18n";
import type { StorefrontView } from "@/lib/storefront";

import { ShopPageView } from "./ShopPageView";

/** The public page as the tests read it: a view drawn from the document that today's section list becomes (`documentFromLegacy`). */
export function Storefront({ view, locale }: Readonly<{ view: StorefrontView; locale: Locale }>) {
  return <ShopPageView page={documentFromLegacy({ sections: view.sections, trade: "salon" })} view={view} locale={locale} today="2026-10-19" />;
}
