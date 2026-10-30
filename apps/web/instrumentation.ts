/**
 * At server start: refuse to run without the production secrets, then apply the database migrations (one advisory lock,
 * so a second instance waits instead of racing).
 */
// @fixed: how often the webhook queue is looked at, in milliseconds
const WEBHOOK_TICK_MS = 10_000;
// @fixed: how often the Monday brief e-mails are looked at (each is due from Monday 7:00 in its shop's zone), in milliseconds
const BRIEF_TICK_MS = 900_000;
// @fixed: how often the connected calendars that are due are looked at, in milliseconds (each has its own interval, set by the administrator)
const CALENDAR_TICK_MS = 60_000;

// @fixed: how often Explorer's stored availability (next free time, open this week) is settled, in milliseconds: the stale window the list can show
const EXPLORE_TICK_MS = 60_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionEnv, readEnv } = await import("./lib/env");
  assertProductionEnv();
  if (!readEnv().DATABASE_URL) {
    console.warn("[akinaza] DATABASE_URL is not set: the public pages work, the shop does not.");
    return;
  }
  const { migrate } = await import("./lib/db");
  await migrate();
  console.log("[akinaza] migrations up to date");
  // Webhook deliveries (and their retries) go out from here: a tick every few seconds, leased so several instances never send twice.
  const { deliverDueWebhooks } = await import("./app/webhooks-edge");
  const { systemClock } = await import("./app/system-clock");
  setInterval(() => void deliverDueWebhooks(systemClock.now()).catch((error) => console.error("[akinaza] webhook tick failed", error)), WEBHOOK_TICK_MS).unref();
  // The Monday brief by e-mail: claimed per shop and week in the database, so several instances never send twice.
  const { sendDueBriefsAt } = await import("./app/brief-edge");
  setInterval(() => void sendDueBriefsAt(systemClock.now()).catch((error) => console.error("[akinaza] brief tick failed", error)), BRIEF_TICK_MS).unref();
  // The owner's other calendars (ADR-004): the due ones are read, leased in the database so several instances never read the same one.
  const { syncDueCalendars } = await import("./lib/calendar/sync");
  const { dataKey } = await import("./lib/env");
  const { calendarSourceMaker } = await import("./app/calendar-edge");
  setInterval(() => void calendarSourceMaker().then((make) => syncDueCalendars(systemClock.now(), dataKey(), make)).catch((error) => console.error("[akinaza] calendar tick failed", error)), CALENDAR_TICK_MS).unref();
  // Explorer's stored availability (ADR-006 decision 4): the rows a change, a new day or the passing time made due are recomputed; the sweep leases them in the database.
  const { settleAvailability } = await import("@akinaza/db");
  const { db } = await import("./lib/db");
  setInterval(() => void settleAvailability(db(), systemClock.now()).catch((error) => console.error("[akinaza] explore availability tick failed", error)), EXPLORE_TICK_MS).unref();
}
