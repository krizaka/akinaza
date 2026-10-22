"use server";

import { cookies } from "next/headers";

import { pageSession } from "@/lib/access";
import { SHOP_COOKIE } from "@/lib/current-shop";
import { memberOf } from "@/lib/member-shop";

const ONE_YEAR_SECONDS = 365 * 24 * 3600; // @fixed: the last shop should outlive a visit, like a language choice.

/** Remembers the shop the person just worked in, so a bare `/app` returns to it. Ignored for a shop they do not belong to. */
export async function rememberShop(shopId: string): Promise<void> {
  const signedIn = await pageSession();
  if (!signedIn || !(await memberOf(signedIn.account.id, shopId))) return;
  (await cookies()).set(SHOP_COOKIE, shopId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_YEAR_SECONDS });
}
