import { requireShop } from "@/lib/access";
import { loadShopBrief } from "@/lib/brief";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** This week's brief of the shop (owner and manager): three cards at most, and what was already done with them. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "reports");
    return Response.json(await loadShopBrief(shop, new Date()));
  });
}
