import { localDay, localInstant } from "@akinaza/core";
import { addDays } from "date-fns";
import { and, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { services, shopZones } from "./schema";
import { bookVisit, listSlots } from "./service-shop";
import { shopClients } from "./visits";

/**
 * Brings the Saint-Henri persona back to a known state for a recording: every booking still standing in the future is
 * cancelled (a visit already started, or past, is left as it is), then each client gets one open group walk at the next
 * 14:00 slot that has room. Through the same operations the product uses: no row is written around the rules.
 * Idempotent: a second run cancels what the first one booked and books the same walks again.
 */
export async function resetWalkerPersona(db: Db, shopId: string, now: Date): Promise<{ cancelled: number; recreated: number }> {
  const cancelledRows = await db.execute(sql`
    UPDATE bookings SET status = 'cancelled', cancelled_at = ${now.toISOString()}::timestamptz
      FROM appointments a
     WHERE a.id = bookings.appointment_id AND a.shop_id = ${shopId} AND bookings.status = 'booked'
       AND a.status = 'booked' AND a.checked_in_at IS NULL AND lower(a.during) > ${now.toISOString()}::timestamptz
    RETURNING bookings.id`);
  await db.execute(sql`
    UPDATE appointments SET status = 'cancelled'
     WHERE shop_id = ${shopId} AND status = 'booked' AND checked_in_at IS NULL AND lower(during) > ${now.toISOString()}::timestamptz
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.appointment_id = appointments.id AND b.status = 'booked')`);

  const [group] = await db.select({ id: services.id }).from(services).where(and(eq(services.shopId, shopId), eq(services.nameEn, "Group walk 60 min")));
  const [zone] = await db.select({ id: shopZones.id }).from(shopZones).where(and(eq(shopZones.shopId, shopId), eq(shopZones.name, "Saint-Henri")));
  if (!group || !zone) throw new Error("the Saint-Henri group walk and zone must exist: seed the persona first");

  const slotAt = async (day: string) => {
    const wanted = localInstant(day, 14 * 60, "America/Toronto").getTime();
    return (await listSlots(db, { shopId, serviceId: group.id, zoneId: zone.id, now, fromDay: day, days: 1 })).find((s) => s.startsAt.getTime() === wanted);
  };
  let upcoming: Awaited<ReturnType<typeof slotAt>>;
  for (let ahead = 0; ahead <= 7 && !upcoming; ahead++) upcoming = await slotAt(localDay(addDays(now, ahead), "America/Toronto"));
  if (!upcoming) throw new Error("no 14:00 group walk slot in the next week");

  let recreated = 0;
  for (const client of await shopClients(db, shopId)) {
    const [dog] = client.dependants;
    if (!dog) continue;
    await bookVisit(db, { clientId: client.id, serviceId: group.id, zoneId: zone.id, dependantIds: [dog.id], startsAt: upcoming.startsAt, now });
    recreated += 1;
  }
  return { cancelled: cancelledRows.rows.length, recreated };
}
