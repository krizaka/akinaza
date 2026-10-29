import { lookup } from "node:dns/promises";

import { createWebhooks, endpointUrlProblem, type Send, WEBHOOK_CODE, WebhookError } from "@krizaka/webhooks";

import { query } from "./db";
import { refuse } from "./http";
import { appSettings } from "./settings";

/** The events Akinaza tells an owner's systems about (#178): a new booking, an invoice paid in full. */
export const WEBHOOK_EVENTS = ["booking.created", "invoice.paid"] as const;

/** The pace of retries: after the 1st failure 30 s, then 5 min, 30 min, 2 h, 12 h; six tries in all. */
// @fixed: the retry schedule of a webhook, in seconds — the contract with the receivers (documented), not a business parameter
const BACKOFF_SECONDS = [30, 300, 1800, 7200, 43_200];
// @fixed: tries before a delivery is given up
const MAX_ATTEMPTS = 6;
// @fixed: how long a receiver may take to answer, in milliseconds
const SEND_TIMEOUT_MS = 10_000;

export const webhooks = (sealer?: { seal: (plain: string) => string; open: (sealed: string) => string }) =>
  createWebhooks({ query: async (sql, params) => query(sql, params as unknown[]) as never, rules: { events: WEBHOOK_EVENTS, maxAttempts: MAX_ATTEMPTS, backoffSeconds: BACKOFF_SECONDS }, secrets: sealer });

/** The HTTP call of a delivery: no redirect followed, a short timeout, and the address the name resolves to must be public too (no DNS trick to reach the inside). */
export const sendWebhook: Send = async ({ url, body, headers }) => {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  for (const { address } of await lookup(host, { all: true })) {
    const authority = address.includes(":") ? `[${address}]` : address;
    if (endpointUrlProblem(`https://${authority}/`)) throw new Error("the address resolves to a private network");
  }
  const res = await fetch(url, { method: "POST", body, headers, redirect: "manual", signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
  return { status: res.status };
};

/** Quota and switch for an owner: the global switch is on, and the endpoints they hold are below the limit. */
export async function webhookQuota(ownerId: string): Promise<number> {
  const s = appSettings();
  if (!(await s.get("features.webhooks", { userId: ownerId }))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "webhooks" });
  return s.get("limits.webhookEndpoints", { userId: ownerId });
}

/** What the API answers for a refusal of the package. */
export const webhookRefusal = (error: unknown) => {
  if (!(error instanceof WebhookError)) return null;
  const status = ({ [WEBHOOK_CODE.notFound]: 404, [WEBHOOK_CODE.limit]: 409 } as Record<string, number>)[error.code] ?? 400;
  return refuse(status, error.code, error.message);
};

/** Tells the owner's systems an event happened — never lets a failure here undo what already happened. */
export async function emitWebhook(ownerId: string | null, event: { id: string; type: (typeof WEBHOOK_EVENTS)[number]; payload: unknown }, now: Date): Promise<void> {
  if (!ownerId) return;
  try {
    if (!(await appSettings().get("features.webhooks", { userId: ownerId }))) return;
    await webhooks().emit(ownerId, event, now);
  } catch (error) {
    console.error(`webhooks: ${event.type} not queued`, error);
  }
}
