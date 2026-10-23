import { randomUUID } from "node:crypto";

import { verifySignature } from "@krizaka/webhooks";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hooks } from "@/app/webhooks-edge";
import { migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";
import { appSettings } from "@/lib/settings";

import { POST as join } from "./me/join/route";
import { POST as payInvoice } from "./walker/invoices/[id]/payments/route";
import { POST as invoices } from "./walker/invoices/route";
import { POST as services } from "./walker/services/route";
import { POST as shop } from "./walker/shop/route";
import { GET as deliveries } from "./walker/webhooks/[id]/deliveries/route";
import { POST as rotateHook } from "./walker/webhooks/[id]/rotate/route";
import { DELETE as removeHook, PATCH as patchHook } from "./walker/webhooks/[id]/route";
import { GET as listHooks, POST as addHook } from "./walker/webhooks/route";

/** Webhooks and payments over HTTP, on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { cookie?: string; json?: unknown; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = `${SESSION_COOKIE}=${opts.cookie}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }), { params: Promise.resolve((opts.params ?? {}) as never) });
  return { status: res.status, body: (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : null };
}

describe.runIf(enabled)("webhooks and payments over HTTP", () => {
  // Unique across test files run in parallel: two files starting in the same millisecond collided on accounts_email_unique.
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const sessions: Record<string, string> = {};
  const ids: { client?: string; service?: string } = {};
  const make = async (label: string) => {
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [`${label}-${stamp}@akinaza.test`]);
    sessions[label] = (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token;
  };
  beforeAll(async () => {
    await migrate();
    for (const label of ["owner", "stranger", "client"]) await make(label);
    await call(shop, "POST", "/api/walker/shop", { cookie: sessions.owner, json: { name: "Studio", legalName: "Studio inc. (démo)", address: "1 rue Test", slug: `hook-${stamp}`, ownerName: "Éric" } });
    await query("UPDATE shops SET registrant = true, gst_number = '123456789RT0001', qst_number = '1234567890TQ0001' WHERE slug = $1", [`hook-${stamp}`]);
    ids.service = (await call(services, "POST", "/api/walker/services", { cookie: sessions.owner, json: { nameFr: "Dev", nameEn: "Dev", durationMinutes: 60, priceCents: 10_000, capacity: 1 } })).body.id;
    const [{ id: shopId } = { id: "" }] = await query<{ id: string }>("SELECT id FROM shops WHERE slug = $1", [`hook-${stamp}`]);
    ids.client = (await call(join, "POST", "/api/me/join", { cookie: sessions.client, json: { shopId, fullName: "Client (démo)", phone: "514-555-0100", language: "fr", consentService: true } })).body.clientId;
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  const invoice = async (qty = 1) => (await call(invoices, "POST", "/api/walker/invoices", { cookie: sessions.owner, json: { clientId: ids.client, language: "fr", issuedOn: "2026-10-21", lines: [{ serviceId: ids.service, quantity: qty }] } })).body as { id: string; totalCents: number };

  it("manages endpoints: only https public addresses, the secret once and sealed, a quota, the owner only", async () => {
    const owner = sessions.owner;
    expect((await call(listHooks, "GET", "/api/walker/webhooks")).status).toBe(401);
    expect((await call(addHook, "POST", "/api/walker/webhooks", { cookie: owner, json: { url: "http://example.com/x", events: ["invoice.paid"] } })).body.code).toBe("WEBHOOK_URL");
    expect((await call(addHook, "POST", "/api/walker/webhooks", { cookie: owner, json: { url: "https://169.254.169.254/x", events: ["invoice.paid"] } })).body.code).toBe("WEBHOOK_URL");
    expect((await call(addHook, "POST", "/api/walker/webhooks", { cookie: owner, json: { url: "https://hooks.example.com/a", events: ["nope"] } })).body.code).toBe("WEBHOOK_EVENTS");
    const made = await call(addHook, "POST", "/api/walker/webhooks", { cookie: owner, json: { url: "https://hooks.example.com/a", events: ["invoice.paid", "booking.created"] } });
    expect(made.status).toBe(201);
    expect(made.body.secret).toMatch(/^whsec_/);
    const [{ secret_sealed }] = await query<{ secret_sealed: string }>("SELECT secret_sealed FROM webhook_endpoints WHERE id = $1", [made.body.endpoint.id]);
    expect(secret_sealed).not.toContain(made.body.secret);
    expect(JSON.stringify((await call(listHooks, "GET", "/api/walker/webhooks", { cookie: owner })).body)).not.toContain(made.body.secret);
    // another owner sees and touches nothing of it
    expect((await call(listHooks, "GET", "/api/walker/webhooks", { cookie: sessions.stranger })).status).toBe(403); // no shop
    expect((await call(patchHook, "PATCH", "/x", { cookie: owner, params: { id: made.body.endpoint.id }, json: { active: false } })).body.endpoint.active).toBe(false);
    const rotated = await call(rotateHook, "POST", "/x", { cookie: owner, params: { id: made.body.endpoint.id } });
    expect(rotated.body.secret).not.toBe(made.body.secret);
    expect((await call(deliveries, "GET", "/x", { cookie: owner, params: { id: made.body.endpoint.id } })).body.deliveries).toEqual([]);
    expect((await call(removeHook, "DELETE", "/x", { cookie: owner, params: { id: made.body.endpoint.id } })).status).toBe(200);
  });

  it("records payments (never more than due, none on a credit note); the payment that completes an invoice tells invoice.paid, once, signed", async () => {
    const owner = sessions.owner;
    const hook = await call(addHook, "POST", "/api/walker/webhooks", { cookie: owner, json: { url: "https://hooks.example.com/paid", events: ["invoice.paid"] } });
    const inv = await invoice();
    const half = Math.floor(inv.totalCents / 2);
    expect((await call(payInvoice, "POST", "/x", { cookie: sessions.stranger, params: { id: inv.id }, json: { method: "cash", amountCents: half } })).status).toBe(403);
    const first = await call(payInvoice, "POST", "/x", { cookie: owner, params: { id: inv.id }, json: { method: "cash", amountCents: half } });
    expect(first.body).toMatchObject({ paid: false, becamePaid: false, paidCents: half });
    expect((await query("SELECT 1 FROM webhook_deliveries WHERE event_id = $1", [`invoice-paid:${inv.id}`]))).toHaveLength(0);
    expect((await call(payInvoice, "POST", "/x", { cookie: owner, params: { id: inv.id }, json: { method: "card", amountCents: inv.totalCents } })).body.code).toBe("OVERPAYMENT");
    const last = await call(payInvoice, "POST", "/x", { cookie: owner, params: { id: inv.id }, json: { method: "transfer", amountCents: inv.totalCents - half } });
    expect(last.body).toMatchObject({ paid: true, becamePaid: true, paidCents: inv.totalCents });
    expect((await call(payInvoice, "POST", "/x", { cookie: owner, params: { id: inv.id }, json: { method: "cash", amountCents: 1 } })).body.code).toBe("OVERPAYMENT");
    const queued = await query<{ n: number }>("SELECT count(*)::int AS n FROM webhook_deliveries WHERE event_id = $1", [`invoice-paid:${inv.id}`]);
    expect(queued[0]!.n).toBe(1);
    // the delivery, as the receiver sees it
    const seen: { body: string; signature: string }[] = [];
    const now = new Date();
    await hooks().deliverDue(now, async (r) => (seen.push({ body: r.body, signature: r.headers["x-krizaka-signature"]! }), { status: 200 }));
    const mine = seen.find((s) => (JSON.parse(s.body) as { id: string }).id === `invoice-paid:${inv.id}`)!;
    expect(JSON.parse(mine.body)).toMatchObject({ type: "invoice.paid", data: { invoiceId: inv.id, totalCents: inv.totalCents } });
    expect(verifySignature(hook.body.secret, mine.body, mine.signature, Math.floor(now.getTime() / 1000)).ok).toBe(true);
    expect((await call(deliveries, "GET", "/x", { cookie: owner, params: { id: hook.body.endpoint.id } })).body.deliveries[0]).toMatchObject({ status: "delivered", eventType: "invoice.paid" });
  });

  it("when the administrator switches webhooks off nothing is queued and a new endpoint is refused — and the payment still counts", async () => {
    const admin = { id: null, label: "vitest" };
    await appSettings().set(admin, { scope: "global", id: "" }, "features.webhooks", false, new Date());
    try {
      expect((await call(addHook, "POST", "/api/walker/webhooks", { cookie: sessions.owner, json: { url: "https://hooks.example.com/off", events: ["invoice.paid"] } })).body.code).toBe("FEATURE_OFF");
      const inv = await invoice(2);
      expect((await call(payInvoice, "POST", "/x", { cookie: sessions.owner, params: { id: inv.id }, json: { method: "cash", amountCents: inv.totalCents } })).body.becamePaid).toBe(true);
      expect(await query("SELECT 1 FROM webhook_deliveries WHERE event_id = $1", [`invoice-paid:${inv.id}`])).toHaveLength(0);
    } finally {
      await appSettings().reset(admin, { scope: "global", id: "" }, "features.webhooks", new Date());
    }
  });
});
