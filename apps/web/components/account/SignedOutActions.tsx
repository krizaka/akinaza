"use client";

import { ProductBarActions } from "@krizaka/ui/nav-bar";
import Link from "next/link";

/** « Sign in » and « Try Akinaza » (or nothing but the first when sign-up is closed): the bar's actions for a visitor with no session, with no script of their own. */
export function SignedOutActions({ locale, placement, signupOpen, signIn, tryIt }: { locale: "en" | "fr"; placement: "bar" | "panel"; signupOpen: boolean; signIn: string; tryIt: string }) {
  return <ProductBarActions placement={placement} signupOpen={signupOpen} linkAs={Link} signIn={{ href: `/${locale}/sign-in`, label: signIn }} tryIt={{ href: `/${locale}/sign-up`, label: tryIt }} />;
}
