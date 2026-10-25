import { useQuery } from "@krizaka/query";
import { Redirect } from "expo-router";
import * as React from "react";

import { queries } from "@/config";
import { routes } from "@/domain/links";
import { QueryStates } from "@/ui/QueryStates";
import { useLocale } from "@/use-locale";

/** `/fr/app`: the member's shop, opened at its own address (the day names its shop), as the web sends a bare `/app` to it. */
export default function Home() {
  const { locale } = useLocale();
  const day = useQuery(queries.day());
  return <QueryStates query={day}>{(d) => <Redirect href={routes.today(locale, d.shopId) as never} />}</QueryStates>;
}
