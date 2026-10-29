import { useQuery } from "@krizaka/query";
import { Redirect } from "expo-router";
import * as React from "react";

import { queries } from "@/config";
import { type Legacy, legacyRoute } from "@/domain/links";
import { QueryStates } from "@/ui/QueryStates";
import { useLocale } from "@/use-locale";

/** An address of the app before D8 (`/fr/app/calendar`…): it opens the same place at the shop's own address. */
export function LegacyRedirect({ from }: Readonly<{ from: Legacy }>) {
  const { locale } = useLocale();
  const day = useQuery(queries.day());
  return <QueryStates query={day}>{(d) => <Redirect href={legacyRoute(locale, from, d.shopId) as never} />}</QueryStates>;
}
