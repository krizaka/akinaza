import { describePrices } from "@krizaka/settings";

import { systemClock } from "@/app/system-clock";
import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { appPrices } from "@/lib/price-catalogue";

export const dynamic = "force-dynamic";

/** The catalogue of prices for the admin screen (akinaza#371): each entry in force, what is scheduled, and each entry's history. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const catalogue = appPrices();
    const described = await describePrices(catalogue, systemClock.now());
    const history = Object.fromEntries(await Promise.all(described.entries.map(async (e) => [e.key, await catalogue.history(e.key)] as const)));
    return Response.json({ ...described, history });
  });
}
