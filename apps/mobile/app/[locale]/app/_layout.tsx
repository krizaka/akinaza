import { Redirect, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import * as React from "react";

import { AUTH, useAuth } from "@/auth";

/** The signed-in space: the shop's tabs (`[shop]`) and the account's profile; signed out, the way is back to sign-in. */
export default function AppLayout() {
  const { status } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string>>();
  if (status === AUTH.signedOut) {
    // The screen the link asked for comes back after signing in (sign-in checks it is one of the app's).
    const query = new URLSearchParams(Object.entries(params).filter(([k, v]) => k !== "locale" && k !== "shop" && typeof v === "string") as [string, string][]).toString();
    return <Redirect href={{ pathname: "/sign-in", params: { next: `${pathname}${query ? `?${query}` : ""}` } } as never} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
