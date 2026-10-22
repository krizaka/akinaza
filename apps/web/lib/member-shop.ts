import { SHOP_ROLES, shopOfMember, type ShopPermission, type ShopRole, shopsOfMember } from "@akinaza/db";
import { can } from "@krizaka/auth";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { pageSession } from "./access";
import { SHOP_COOKIE } from "./current-shop";
import { db } from "./db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The shop a signed-in person works in, with their role there: the one chosen in the switcher, else their default. Null when they belong to none. */
export async function currentMember(accountId: string) {
  const chosen = (await cookies()).get(SHOP_COOKIE)?.value;
  const asked = chosen && UUID.test(chosen) ? await shopOfMember(db(), accountId, chosen) : null;
  return asked ?? (await shopOfMember(db(), accountId));
}

/** Every shop the person works in, for the switcher. */
export const shopsOf = (accountId: string) => shopsOfMember(db(), accountId);

/** What a role may do: the table is `SHOP_ROLES`, never a check on a role name. */
export const may = (role: ShopRole, permission: ShopPermission) => can(SHOP_ROLES, role, permission);

/**
 * The page's shop for a member who may do `permission` there. 404 for someone with no shop and for a role that does not hold it:
 * a page does not announce itself to a role that cannot see it.
 */
export async function memberShop(permission: ShopPermission) {
  const session = (await pageSession())!;
  const member = await currentMember(session.account.id);
  if (!member || !may(member.role, permission)) notFound();
  return { session, shop: member.shop, role: member.role };
}
