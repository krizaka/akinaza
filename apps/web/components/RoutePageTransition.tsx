"use client";

import { PageTransition } from "@krizaka/ui/motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The page change of the whole site (@krizaka/ui PageTransition), keyed by the pathname: only a change of page cross-fades.
 * An update of the same page (the appointment drawer opened through `?visit=`, a day, a filter) never does — it used to
 * close the drawer it had just opened (#171).
 */
export function RoutePageTransition({ children }: { children: ReactNode }) {
  return <PageTransition routeKey={usePathname()}>{children}</PageTransition>;
}
