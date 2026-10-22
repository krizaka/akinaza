/**
 * At server start: refuse to run without the production secrets, then apply the database migrations (one advisory lock,
 * so a second instance waits instead of racing).
 */
// @fixed: how often the webhook queue is looked at, in milliseconds
const WEBHOOK_TICK_MS = 10_000;
// @fixed: how often the Monday brief e-mails are looked at (each is due from Monday 7:00 in its shop's zone), in milliseconds
const BRIEF_TICK_MS = 900_000;

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
}
