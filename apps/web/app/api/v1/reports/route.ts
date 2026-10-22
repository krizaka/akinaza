import { prepareShopReturn } from "@akinaza/db";

import { v1 } from "@/lib/api-v1";
import { db } from "@/lib/db";
import { refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The GST/QST return prepared for a period (`?from=&to=`, YYYY-MM-DD) — prepared, never filed. Scope `reports:read`. */
export const GET = (req: Request) =>
  v1(req, "reports:read", async (shop, url) => {
    const [from, to] = [url.searchParams.get("from") ?? "", url.searchParams.get("to") ?? ""];
    if (!DAY.test(from) || !DAY.test(to) || from > to) throw refuse(400, "BAD_REQUEST", "from and to are YYYY-MM-DD, from before to");
    return { from, to, return: await prepareShopReturn(db(), shop.id, from, to) };
  });
