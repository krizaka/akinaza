import { shopOfMember } from "@akinaza/db";
import { cookies } from "next/headers";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { SHOP_COOKIE } from "@/lib/current-shop";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

const ONE_YEAR_SECONDS = 365 * 24 * 3600; // @fixed: a shop choice should outlive a session, like a language choice.

/** The switcher: the person works in this shop from now on. Only a shop they are a member of. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const { shopId } = await readJson(req, z.object({ shopId: z.string().uuid() }));
    if (!(await shopOfMember(db(), session.account.id, shopId))) throw refuse(404, "NOT_FOUND", "Not found");
    (await cookies()).set(SHOP_COOKIE, shopId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_YEAR_SECONDS });
    return Response.json({ shopId });
  });
}
