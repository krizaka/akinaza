/**
 * What the HTTP integration tests share: calling a route handler as someone, a throwaway account with a session, and a shop
 * open for booking (a zone, a service, every day's hours, the rules, published). Test-only; never imported by the app.
 */
import { vi } from "vitest";

import { pool, query } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as hours } from "./walker/hours/route";
import { POST as rules } from "./walker/rules/route";
import { POST as services } from "./walker/services/route";
import { POST as shop } from "./walker/shop/route";
import { POST as zones } from "./walker/zones/route";

export type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
export type CallOptions = { token?: string; json?: unknown; form?: FormData; params?: Record<string, string> };

/** A route handler called as the session `token` (or nobody), with a JSON body or a form. */
export async function apiCall(handler: unknown, method: string, path: string, opts: CallOptions = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.form }), { params: Promise.resolve(opts.params ?? {}) });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, body: type.includes("json") ? await res.json() : null };
}

/** An account `<label>-<stamp>@akinaza.test` and a session for it. */
export async function testAccount(label: string, stamp: string) {
  const email = `${label}-${stamp}@akinaza.test`;
  const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [email]);
  return { id: row!.id, email, token: (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token };
}

export const testShopPage = (name: string, slug: string) => ({ name, legalName: name, address: "2000 rue Notre-Dame O., Montréal QC", slug, ownerName: "Owner", taglineFr: "Quartier", published: false });

/** The owner's shop, open for booking every day 08:00–20:00 and published: its id, its zone, its service and the last hour's id. */
export async function openBookableShop(token: string, name: string, slug: string) {
  const as = { token };
  const shopId = (await apiCall(shop, "POST", "/api/walker/shop", { ...as, json: testShopPage(name, slug) })).body.shopId as string;
  const zone = (await apiCall(zones, "POST", "/api/walker/zones", { ...as, json: { name: `Zone ${name}` } })).body.id as string;
  const service = (await apiCall(services, "POST", "/api/walker/services", { ...as, json: { nameFr: "Coupe", nameEn: "Cut", durationMinutes: 60, priceCents: 3000, capacity: 1 } })).body.id as string;
  let hour = "";
  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) hour = (await apiCall(hours, "POST", "/api/walker/hours", { ...as, json: { weekday, startsAt: "08:00", endsAt: "20:00" } })).body.id;
  await apiCall(rules, "POST", "/api/walker/rules", { ...as, json: { cancellationHours: 2, bookingHorizonDays: 30, slotStepMinutes: 30, minNoticeMinutes: 0, reportLinkDays: 30, paymentTermsDays: 30 } });
  await apiCall(shop, "POST", "/api/walker/shop", { ...as, json: { ...testShopPage(name, slug), published: true } });
  return { shopId, zone, service, hour };
}

/** The HTTP verbs a route file may export. */
export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type Method = (typeof METHODS)[number];

/** The handlers a route module exports, by verb (`load` is one entry of an `import.meta.glob`). */
export async function handlersOf(load: () => Promise<Record<string, unknown>>): Promise<{ method: Method; handler: Handler }[]> {
  const mod = await load();
  return METHODS.filter((m) => typeof mod[m] === "function").map((method) => ({ method, handler: mod[method] as Handler }));
}

/** The end of a suite: its accounts go (shops stay: the ledger and the consents are written once), the env and the pool close. */
export async function closeSuite(stamp: string) {
  await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
  vi.unstubAllEnvs();
  await pool().end();
}
