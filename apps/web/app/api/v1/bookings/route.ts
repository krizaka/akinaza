import { dayVisits, shopDay } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";
import { v1 } from "@/lib/api-v1";
import { db } from "@/lib/db";
import { refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The shop's visits of a day (`?day=YYYY-MM-DD`, today in the shop's time zone by default). Scope `bookings:read`. */
export const GET = (req: Request) =>
  v1(req, "bookings:read", async (shop, url) => {
    const asked = url.searchParams.get("day");
    if (asked !== null && !/^\d{4}-\d{2}-\d{2}$/.test(asked)) throw refuse(400, "BAD_REQUEST", "day is YYYY-MM-DD");
    const day = asked ?? (await shopDay(db(), shop.id, systemClock.now()));
    return { day, bookings: await dayVisits(db(), shop.id, day) };
  });
