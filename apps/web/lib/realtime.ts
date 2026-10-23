import { REALTIME_CHANNEL, slotsTopic } from "@akinaza/core";
import { createBus, type RealtimeBus } from "@krizaka/realtime";
import { pgChannel } from "@krizaka/realtime/pg";

import { pool } from "./db";
import { readEnv } from "./env";

/**
 * The app's one realtime door (@krizaka/realtime): PostgreSQL LISTEN/NOTIFY by default — no extra service to run or pay
 * for. LISTEN needs a session, so it uses DATABASE_DIRECT_URL (never a transaction pooler); NOTIFY goes through the pool.
 * Best-effort by contract: the bookings live in the database; an event only says "this slot changed".
 */
const holder = globalThis as unknown as { __akinazaBus?: RealtimeBus };

export function realtimeBus(): RealtimeBus {
  if (holder.__akinazaBus) return holder.__akinazaBus;
  const env = readEnv();
  holder.__akinazaBus =
    env.REALTIME_BUS === "memory"
      ? createBus({ kind: "memory" })
      : createBus({ kind: "postgres", channel: REALTIME_CHANNEL, postgres: pgChannel({ listen: env.DATABASE_DIRECT_URL ?? env.DATABASE_URL ?? "", notify: pool() }) });
  return holder.__akinazaBus;
}

/** Tells the open storefronts that this shop's slots changed. The booking is already committed: a bus failure never turns it into an error. */
export async function announceSlots(shopId: string): Promise<void> {
  try {
    await realtimeBus().publish(slotsTopic(shopId), { type: "slots.changed" });
  } catch (error) {
    console.error("storefront slots event not published", error);
  }
}

export { slotsTopic };
