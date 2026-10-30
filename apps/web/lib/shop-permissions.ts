import { SHOP_ROLES, type ShopPermission, type ShopRole } from "@akinaza/db/roles";
import { can } from "@krizaka/auth/client";

/**
 * What a role may do in a shop, from the roles table alone: no database, no request cookies, so a client component (the shop's
 * frame, its rail) can read it. The server side re-exports it.
 */
export const may = (role: ShopRole, permission: ShopPermission) => can(SHOP_ROLES, role, permission);
