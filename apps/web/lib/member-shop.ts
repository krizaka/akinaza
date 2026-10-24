import { shopOfMember, type ShopPermission, shopsOfMember } from "@akinaza/db";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { pageSession } from "./access";
import { SHOP_COOKIE } from "./current-shop";
import { db } from "./db";
import { isShopId } from "./shop-id";
import { may } from "./shop-permissions";

/** The shop a person works in when no address names one: the last they worked in (the cookie), else their default. Null when they belong to none. */
export async function lastMember(accountId: string) {
  const chosen = (await cookies()).get(SHOP_COOKIE)?.value;
  const asked = chosen && isShopId(chosen) ? await shopOfMember(db(), accountId, chosen) : null;
  return asked ?? (await shopOfMember(db(), accountId));
}

/** The person's membership of the shop an address names: null for a shop that does not exist or that they do not belong to. */
export async function memberOf(accountId: string, shopId: string) {
  return isShopId(shopId) ? shopOfMember(db(), accountId, shopId) : null;
}

/** Every shop the person works in, for the switcher. */
export const shopsOf = (accountId: string) => shopsOfMember(db(), accountId);

/** What a role may do: the table is `SHOP_ROLES`, never a check on a role name. */
export { may };

/**
 * The page's shop, named by its address, for a member who may do `permission` there. The address wins over the cookie. 404 for a shop
 * the person does not belong to and for a role that does not hold the permission: a page does not announce itself.
 */
export async function memberShop(shopId: string, permission: ShopPermission) {
  const session = (await pageSession())!;
  const member = await memberOf(session.account.id, shopId);
  if (!member || !may(member.role, permission)) notFound();
  return { session, shop: member.shop, role: member.role };
}
