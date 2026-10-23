import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as join } from "./me/join/route";
import { POST as invoices } from "./walker/invoices/route";
import { POST as services } from "./walker/services/route";
import { POST as shop } from "./walker/shop/route";

/** A services business issues an invoice over HTTP, on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, path: string, opts: { token?: string; json?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method: "POST", headers, body: JSON.stringify(opts.json ?? {}) }), { params: Promise.resolve({} as never) });
  return { status: res.status, body: await res.json(), id: res.headers.get("x-request-id") };
}

describe.runIf(enabled)("a services business issues an invoice over HTTP", () => {
  // Unique across test files run in parallel: two files starting in the same millisecond collided on accounts_email_unique.
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const sessions: Record<"owner" | "stranger" | "client", string> = { owner: "", stranger: "", client: "" };
  const ids: { service?: string; clientFile?: string } = {};
  const account = async (label: string) => {
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [`${label}-${stamp}@akinaza.test`]);
    return (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token;
  };

  beforeAll(async () => {
    await migrate();
    for (const label of ["owner", "stranger", "client"] as const) sessions[label] = await account(label);
    const created = await call(shop, "/api/walker/shop", { token: sessions.owner, json: { name: "Studio Test", legalName: "Studio Test inc. (démo)", address: "1 rue Test, Montréal QC", slug: `studio-${stamp}`, ownerName: "Eric", published: false } });
    expect(created.status).toBeLessThan(300);
    ids.service = (await call(services, "/api/walker/services", { token: sessions.owner, json: { nameFr: "Développement (à l'heure)", nameEn: "Development (hourly)", durationMinutes: 60, priceCents: 15_000, capacity: 1 } })).body.id;
    await query("UPDATE shops SET registrant = true, gst_number = '123456789RT0001', qst_number = '1234567890TQ0001' WHERE slug = $1", [`studio-${stamp}`]);
    const [{ id: shopId } = { id: "" }] = await query<{ id: string }>("SELECT id FROM shops WHERE slug = $1", [`studio-${stamp}`]);
    ids.clientFile = (await call(join, "/api/me/join", { token: sessions.client, json: { shopId, fullName: "Café du Parc inc. (démo)", phone: "514-555-0100", language: "fr", consentService: true } })).body.clientId;
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  it("issues the invoice for the owner only, with the totals to the cent and a balanced ledger", async () => {
    const body = { clientId: ids.clientFile, language: "fr", issuedOn: "2026-10-21", lines: [{ serviceId: ids.service, quantity: 10 }, { description: "Forfait de soutien / Support pack", quantity: 1, unitPriceCents: 50_000 }] };
    expect((await call(invoices, "/api/walker/invoices", { json: body })).status).toBe(401);
    expect((await call(invoices, "/api/walker/invoices", { token: sessions.stranger, json: body })).status).toBe(403);
    const ok = await call(invoices, "/api/walker/invoices", { token: sessions.owner, json: body });
    expect(ok.status).toBe(201);
    expect(ok.id).toBeTruthy();
    expect(ok.body).toMatchObject({ number: "F-00001", subtotalCents: 200_000, gstCents: 10_000, qstCents: 19_950, totalCents: 229_950 });
    const [ledger] = await query<{ gst: number; qst: number }>("SELECT sum(amount_cents) FILTER (WHERE tax = 'gst')::int AS gst, sum(amount_cents) FILTER (WHERE tax = 'qst')::int AS qst FROM tax_ledger WHERE source_id = $1", [ok.body.id]);
    expect(ledger).toMatchObject({ gst: 10_000, qst: 19_950 });
  });

  it("refuses what is not valid, in stable codes", async () => {
    const owner = sessions.owner;
    expect((await call(invoices, "/api/walker/invoices", { token: owner, json: { language: "fr", issuedOn: "2026-10-21", lines: [] } })).body).toMatchObject({ code: "BAD_REQUEST" });
    expect((await call(invoices, "/api/walker/invoices", { token: owner, json: { language: "fr", issuedOn: "2026-10-21", lines: [{ description: "x", quantity: 7.555, unitPriceCents: 100 }] } })).status).toBe(400); // finer than a hundredth
    expect((await call(invoices, "/api/walker/invoices", { token: owner, json: { language: "fr", issuedOn: "2026-10-21", lines: [{ description: "x", quantity: 0, unitPriceCents: 100 }] } })).status).toBe(400);
    expect((await call(invoices, "/api/walker/invoices", { token: owner, json: { language: "fr", issuedOn: "2026-10-21", lines: [{ description: "Travail", quantity: 1 }] } })).body).toMatchObject({ code: "LINE_PRICE" });
    expect((await call(invoices, "/api/walker/invoices", { token: owner, json: { language: "fr", issuedOn: "2026-10-21", lines: [{ serviceId: "00000000-0000-4000-8000-000000000000", quantity: 1 }] } })).status).toBe(404);
  });
});
