import type { ShopRole } from "@akinaza/db/roles";

import { format } from "./i18n";
import { ACCOUNT_SECTIONS, type AccountSection } from "./routes";
import { may } from "./shop-permissions";

/**
 * The account's sections for who is signed in, from the roles table: the subscription is the shop's bill, so it shows to who
 * may handle billing there (the owner) and to a person who runs no shop yet (they would subscribe to open one). A manager or a
 * staff member works in someone else's shop: their account has no subscription to look at.
 */
export function accountSectionsFor(role: ShopRole | null): AccountSection[] {
  return ACCOUNT_SECTIONS.filter((id) => id !== "subscription" || role === null || may(role, "billing"));
}

type RoleWords = { roleAdmin: string; roleIn: string; shopRoles: Record<ShopRole, string> };

/** What the account is, read only on the profile: an administrator, « Propriétaire chez <shop> » / « Employé chez <shop> »; nothing for a client, who holds no role anywhere (akinaza#440). */
export function accountRoleLine(words: RoleWords, who: { admin: boolean; member: { role: ShopRole; shop: { name: string } } | null }): string | null {
  if (who.admin) return words.roleAdmin;
  if (!who.member) return null;
  return format(words.roleIn, { role: words.shopRoles[who.member.role], shop: who.member.shop.name });
}
