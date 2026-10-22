import { SHOP_PERMISSIONS, SHOP_ROLES } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";
import { requireShop } from "@/lib/access";
import { handle } from "@/lib/http";
import { team, teamAct } from "@/lib/team";

export const dynamic = "force-dynamic";

/** The shop's team: members with their roles, pending invitations, and the permission table the roles come from (for the screen to draw). Owner and manager. */
export const GET = (req: Request) =>
  handle(async () => {
    const { shop, role } = await requireShop(req, "team");
    const roles = team();
    return Response.json(await teamAct(async () => ({ shopId: shop.id, you: role, members: await roles.members(shop.id), invitations: await roles.pendingInvitations(shop.id, systemClock.now()), roles: SHOP_ROLES.roles, permissions: SHOP_ROLES.permissions, manages: SHOP_ROLES.manages, all: SHOP_PERMISSIONS })));
  });
