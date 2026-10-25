import { randomBytes, randomUUID } from "node:crypto";

import { addHours } from "date-fns";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db, migrate, pool, query } from "@/lib/db";
import { flushOutbox, sendWalkReport } from "@/lib/mail";
import { resetRateLimits } from "@/lib/rate-limit";
import { realtimeBus, slotsTopic } from "@/lib/realtime";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as notes } from "./me/access-notes/route";
import { POST as cancel } from "./me/bookings/[id]/cancel/route";
import { POST as book } from "./me/bookings/route";
import { POST as addDog } from "./me/dependants/route";
import { POST as erase } from "./me/erase/route";
import { GET as exportData } from "./me/export/route";
import { POST as join } from "./me/join/route";
import { GET as meReportPhoto } from "./me/reports/[id]/photo/route";
import { GET as reportPhoto } from "./report/[token]/photo/route";
import { GET as events } from "./shops/[slug]/events/route";
import { GET as slots } from "./shops/[slug]/slots/route";
import { POST as saveReport } from "./walker/bookings/[id]/report/route";
import { POST as sendReport } from "./walker/bookings/[id]/report/send/route";
import { GET as revealNotes } from "./walker/clients/[id]/access-notes/route";
import { POST as hours } from "./walker/hours/route";
import { POST as rules } from "./walker/rules/route";
import { POST as services } from "./walker/services/route";
import { POST as shop } from "./walker/shop/route";
import { POST as checkIn } from "./walker/visits/[id]/check-in/route";
import { POST as checkOut } from "./walker/visits/[id]/check-out/route";
import { POST as addHook } from "./walker/webhooks/route";
import { POST as zones } from "./walker/zones/route";

/** The dog walker's whole journey through the HTTP surface, on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(300)]);

type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { token?: string; json?: unknown; form?: FormData; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const req = new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.form });
  const res = await (handler as Handler)(req, { params: Promise.resolve((opts.params ?? {}) as never) });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, body: type.includes("json") ? await res.json() : null, res };
}

/**
 * Whether a webhook payload carries something of the client's (their phone, their name, a name field). akinaza#341: the
 * journey once checked `/514/` on the whole JSON, which a random UUID (`…f514…`) matches about one run in ten — the booking
 * step then failed and the four steps after it with it.
 */
const leaksClient = (payload: unknown) => /514-555-0100|Camille|Tremblay|Chien|"(fullName|phone|email)"/.test(JSON.stringify(payload));

describe("the journey's privacy check reads the client's data, never a UUID's digits (akinaza#341)", () => {
  it("passes a payload of ids, even one whose UUID holds « 514 »", () => {
    expect(leaksClient({ appointmentId: "3f8ae756-47dd-4206-b741-4c6a6f514cf2", shopId: "74f669e4-9848-4507-9403-f2514bb0aa11" })).toBe(false);
  });

  it("catches the client's phone, name or a personal field", () => {
    for (const payload of [{ note: "514-555-0100" }, { who: "Camille Tremblay" }, { fullName: "x" }, { phone: "x" }]) expect(leaksClient(payload), JSON.stringify(payload)).toBe(true);
  });
});

describe.runIf(enabled)("the dog walker's journey over HTTP", () => {
  // Unique across test files run in parallel: two files starting in the same millisecond collided on accounts_email_unique.
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  let walker: string;
  let stranger: string;
  let client: string;
  let other: string;
  const ids: { shop?: string; solo?: string; stHenri?: string; clientFile?: string; dog?: string; booking?: string; visit?: string; report?: string; token?: string } = {};

  const account = async (label: string) => {
    const email = `${label}-${stamp}@akinaza.test`;
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [email]);
    return { id: row!.id, email, token: (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token };
  };
  let accounts: { walker: Awaited<ReturnType<typeof account>>; stranger: Awaited<ReturnType<typeof account>>; client: Awaited<ReturnType<typeof account>>; other: Awaited<ReturnType<typeof account>> };

  beforeAll(async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    await migrate();
    accounts = { walker: await account("walker"), stranger: await account("stranger"), client: await account("client"), other: await account("other") };
    ({ walker, stranger, client, other } = { walker: accounts.walker.token, stranger: accounts.stranger.token, client: accounts.client.token, other: accounts.other.token });
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    // The shop stays (the ledger and the consents are written once, so a shop is never deleted); only the accounts go.
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await realtimeBus().close();
    vi.unstubAllEnvs();
    await pool().end();
  });

  it("lets the walker build the shop page — and only the owner touch it", async () => {
    expect((await call(shop, "POST", "/api/walker/shop", { json: {} })).status).toBe(401);
    expect((await call(zones, "POST", "/api/walker/zones", { token: stranger, json: { name: "X" } })).status).toBe(403); // no shop
    const page = { name: "Pattes de Saint-Henri", legalName: "Pattes de Saint-Henri", address: "2000 rue Notre-Dame O., Montréal QC", slug: `pattes-${stamp}`, ownerName: "Mathilde", taglineFr: "Promenades de quartier", published: false };
    expect((await call(shop, "POST", "/api/walker/shop", { token: walker, json: { ...page, slug: "api" } })).status).toBe(400);
    const created = await call(shop, "POST", "/api/walker/shop", { token: walker, json: page });
    expect(created.body).toMatchObject({ created: true });
    ids.shop = created.body.shopId;
    expect((await call(shop, "POST", "/api/walker/shop", { token: walker, json: { ...page, published: true } })).body).toMatchObject({ code: "NOT_PUBLISHABLE" });
    ids.stHenri = (await call(zones, "POST", "/api/walker/zones", { token: walker, json: { name: "Saint-Henri" } })).body.id;
    expect((await call(zones, "POST", "/api/walker/zones", { token: walker, json: { name: "saint-henri" } })).body).toMatchObject({ code: "ZONE_EXISTS" });
    ids.solo = (await call(services, "POST", "/api/walker/services", { token: walker, json: { nameFr: "Promenade solo 60 min", nameEn: "Solo walk 60 min", durationMinutes: 60, priceCents: 3000, capacity: 1 } })).body.id;
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) expect((await call(hours, "POST", "/api/walker/hours", { token: walker, json: { weekday, startsAt: "08:00", endsAt: "20:00" } })).status).toBe(201);
    expect((await call(hours, "POST", "/api/walker/hours", { token: walker, json: { weekday: 1, startsAt: "10:00", endsAt: "11:00" } })).body).toMatchObject({ code: "WINDOW_OVERLAP" });
    expect((await call(rules, "POST", "/api/walker/rules", { token: walker, json: { cancellationHours: 2, bookingHorizonDays: 30, slotStepMinutes: 1, minNoticeMinutes: 0, reportLinkDays: 30, paymentTermsDays: 30 } })).status).toBe(400);
    expect((await call(rules, "POST", "/api/walker/rules", { token: walker, json: { cancellationHours: 2, bookingHorizonDays: 30, slotStepMinutes: 30, minNoticeMinutes: 0, reportLinkDays: 30, paymentTermsDays: 30 } })).status).toBe(200);
    expect((await call(shop, "POST", "/api/walker/shop", { token: walker, json: { ...page, published: true } })).body).toMatchObject({ created: false });
  });

  it("lets a client see the offered slots, join with consent, add a dog, leave a door code, and book", async () => {
    const offered = await call(slots, "GET", `/api/shops/pattes-${stamp}/slots?serviceId=${ids.solo}&zoneId=${ids.stHenri}`, { params: { slug: `pattes-${stamp}` } });
    expect(offered.status).toBe(200);
    expect(offered.body.slots.length).toBeGreaterThan(5);
    expect((await call(slots, "GET", `/api/shops/nope-${stamp}/slots?serviceId=${ids.solo}&zoneId=`, { params: { slug: `nope-${stamp}` } })).status).toBe(404);
    expect((await call(join, "POST", "/api/me/join", { token: client, json: { shopId: ids.shop, fullName: "Camille Tremblay", phone: "514-555-0100", language: "fr", consentService: false } })).status).toBe(400); // the service consent is the file
    const joined = await call(join, "POST", "/api/me/join", { token: client, json: { shopId: ids.shop, fullName: "Camille Tremblay", phone: "514-555-0100", language: "fr", consentService: true, consentReminders: false } });
    ids.clientFile = joined.body.clientId;
    expect((await call(join, "POST", "/api/me/join", { token: client, json: { shopId: ids.shop, fullName: "Camille Tremblay", phone: "514-555-0100", language: "fr", consentService: true } })).body).toMatchObject({ created: false });
    // Another person cannot touch this file.
    expect((await call(addDog, "POST", "/api/me/dependants", { token: other, json: { clientId: ids.clientFile, kind: "dog", name: "Intrus" } })).status).toBe(404);
    ids.dog = (await call(addDog, "POST", "/api/me/dependants", { token: client, json: { clientId: ids.clientFile, kind: "dog", name: "Rex", profile: { breed: "Labrador", size: "large", temperament: "Joueur" } } })).body.id;
    expect((await call(notes, "POST", "/api/me/access-notes", { token: client, json: { clientId: ids.clientFile, notes: "Code 4821, clé sous le pot" } })).status).toBe(200);
    const raw = await query<{ access_notes_enc: string }>("SELECT access_notes_enc FROM clients WHERE id = $1", [ids.clientFile]);
    expect(raw[0]!.access_notes_enc).toMatch(/^v1\./);
    expect(raw[0]!.access_notes_enc).not.toContain("4821");
    // A slot an hour ahead at least: the first one offered can start before the booking reaches the server.
    const start = offered.body.slots.find((slot: { startsAt: string }) => new Date(slot.startsAt) > addHours(new Date(), 1)).startsAt;
    const hook = await call(addHook, "POST", "/api/walker/webhooks", { token: walker, json: { url: "https://hooks.example.com/bookings", events: ["booking.created"] } });
    expect(hook.status).toBe(201);
    const booked = await call(book, "POST", "/api/me/bookings", { token: client, json: { clientId: ids.clientFile, serviceId: ids.solo, zoneId: ids.stHenri, dependantIds: [ids.dog], startsAt: start } });
    expect(booked.status).toBe(201);
    // the shop's systems are told, once, without the client's name or phone
    const told = await query<{ payload: Record<string, unknown> }>("SELECT payload FROM webhook_deliveries WHERE endpoint_id = $1", [hook.body.endpoint.id]);
    expect(told).toHaveLength(1);
    expect(told[0]!.payload).toMatchObject({ appointmentId: booked.body.appointmentId, shopId: ids.shop, serviceId: ids.solo });
    expect(leaksClient(told[0]!.payload)).toBe(false);
    ids.booking = booked.body.bookingIds[0];
    ids.visit = booked.body.appointmentId;
    expect((await call(book, "POST", "/api/me/bookings", { token: client, json: { clientId: ids.clientFile, serviceId: ids.solo, zoneId: ids.stHenri, dependantIds: [ids.dog], startsAt: start } })).body).toMatchObject({ code: "SLOT_UNAVAILABLE" });
    const second = offered.body.slots.find((s: { startsAt: string }) => s.startsAt !== start && new Date(s.startsAt).getTime() > new Date(start).getTime() + 2 * 3_600_000);
    const extra = await call(book, "POST", "/api/me/bookings", { token: client, json: { clientId: ids.clientFile, serviceId: ids.solo, zoneId: ids.stHenri, dependantIds: [ids.dog], startsAt: second.startsAt } });
    expect((await call(cancel, "POST", `/api/me/bookings/${extra.body.bookingIds[0]}/cancel`, { token: other, json: { clientId: ids.clientFile }, params: { id: extra.body.bookingIds[0] } })).status).toBe(404);
    expect((await call(cancel, "POST", `/api/me/bookings/${extra.body.bookingIds[0]}/cancel`, { token: client, json: { clientId: ids.clientFile }, params: { id: extra.body.bookingIds[0] } })).status).toBe(200);
  });

  it("streams a private-free invalidation after a booking or cancellation commits, but not after a refusal", async () => {
    const published: unknown[] = [];
    const unsubscribe = realtimeBus().subscribe(slotsTopic(ids.shop!), (event) => published.push(event));
    const stream = await events(new Request(`http://localhost/api/shops/pattes-${stamp}/events`), { params: Promise.resolve({ slug: `pattes-${stamp}` }) });
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    const expected = 'event: slots.changed\ndata: {"type":"slots.changed"}\n\n';
    try {
      await reader.read(); // retry instruction
      const offered = await call(slots, "GET", `/api/shops/pattes-${stamp}/slots?serviceId=${ids.solo}&zoneId=${ids.stHenri}`, { params: { slug: `pattes-${stamp}` } });
      const start = offered.body.slots.find((slot: { startsAt: string }) => new Date(slot.startsAt) > addHours(new Date(), 3)).startsAt;
      const booked = await call(book, "POST", "/api/me/bookings", { token: client, json: { clientId: ids.clientFile, serviceId: ids.solo, zoneId: ids.stHenri, dependantIds: [ids.dog], startsAt: start } });
      expect(booked.status).toBe(201);
      expect(published).toEqual([{ type: "slots.changed" }]);
      expect(new TextDecoder().decode((await reader.read()).value)).toBe(expected);
      const params = { id: booked.body.bookingIds[0] };
      expect((await call(cancel, "POST", "/x", { token: other, json: { clientId: ids.clientFile }, params })).status).toBe(404);
      expect(published).toHaveLength(1);
      expect((await call(cancel, "POST", "/x", { token: client, json: { clientId: ids.clientFile }, params })).status).toBe(200);
      expect(published).toEqual([{ type: "slots.changed" }, { type: "slots.changed" }]);
      expect(new TextDecoder().decode((await reader.read()).value)).toBe(expected);
    } finally {
      await reader.cancel();
      unsubscribe();
    }
  });

  it("lets the walker check in and out, write the report with a photo, and send it (the mail waits without a provider)", async () => {
    const asVisit = { params: { id: ids.visit! } };
    expect((await call(checkIn, "POST", "/x", { token: client, ...asVisit })).status).toBe(403); // a client is not a walker
    expect((await call(checkIn, "POST", "/x", { token: stranger, ...asVisit })).status).toBe(403);
    const form = () => {
      const f = new FormData();
      f.set("note", "Rex a bien marché, 45 min, pipi ✓");
      f.set("photo", new File([new Uint8Array(JPEG)], "rex.jpg", { type: "image/jpeg" }));
      return f;
    };
    const asBooking = { params: { id: ids.booking! } };
    expect((await call(saveReport, "POST", "/x", { token: walker, form: form(), ...asBooking })).body).toMatchObject({ code: "VISIT_NOT_DONE" });
    expect((await call(checkOut, "POST", "/x", { token: walker, ...asVisit })).body).toMatchObject({ code: "NOT_CHECKED_IN" });
    expect((await call(checkIn, "POST", "/x", { token: walker, ...asVisit })).status).toBe(200);
    expect((await call(checkIn, "POST", "/x", { token: walker, ...asVisit })).body).toMatchObject({ code: "ALREADY_CHECKED_IN" });
    expect((await call(checkOut, "POST", "/x", { token: walker, ...asVisit })).status).toBe(200);
    const bad = new FormData();
    bad.set("note", "x");
    bad.set("photo", new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.jpg", { type: "image/jpeg" }));
    expect((await call(saveReport, "POST", "/x", { token: walker, form: bad, ...asBooking })).body).toMatchObject({ code: "PHOTO_INVALID" });
    const saved = await call(saveReport, "POST", "/x", { token: walker, form: form(), ...asBooking });
    expect(saved.status).toBe(201);
    ids.report = saved.body.reportId;
    const sent = await call(sendReport, "POST", "/x", { token: walker, ...asBooking });
    expect(sent.body).toMatchObject({ status: "pending" }); // MAIL_PROVIDER=none: fails closed, kept in the outbox
    const [mail] = await query<{ to_email: string; subject: string; html: string; body_text: string; last_error: string }>("SELECT to_email, subject, html, body_text, last_error FROM mail_outbox WHERE related_id = $1", [ids.report]);
    expect(mail).toMatchObject({ to_email: accounts.client.email, last_error: "MAIL_NOT_CONFIGURED" });
    expect(mail!.subject).toContain("Rex");
    expect(mail!.body_text).toContain("Rex a bien marché, 45 min, pipi ✓");
    ids.token = /report\/(rp1\.[A-Za-z0-9_-]{43})/.exec(mail!.body_text)?.[1];
    expect(ids.token).toBeTruthy();
    expect(mail!.html).toContain(`/fr/report/${ids.token}`);
  });

  it("serves the report photo to the private link and to the owner only", async () => {
    const byLink = await call(reportPhoto, "GET", `/api/report/${ids.token}/photo`, { params: { token: ids.token! } });
    expect(byLink.status).toBe(200);
    expect(byLink.res.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await byLink.res.arrayBuffer()).equals(JPEG)).toBe(true);
    expect((await call(reportPhoto, "GET", "/api/report/rp1.bad/photo", { params: { token: "rp1.bad" } })).status).toBe(404);
    expect((await call(meReportPhoto, "GET", `/x?clientId=${ids.clientFile}`, { token: client, params: { id: ids.report! } })).status).toBe(200);
    expect((await call(meReportPhoto, "GET", `/x?clientId=${ids.clientFile}`, { token: other, params: { id: ids.report! } })).status).toBe(404);
  });

  it("delivers through the mail provider when it is configured — one POST, the key in the header only — and gives up after five failures", async () => {
    const mailgun = { provider: "mailgun" as const, apiKey: "key-secret-1", domain: "mg.example.test", from: "Akinaza <no-reply@mg.example.test>", apiUrl: "https://api.mailgun.net", appUrl: "https://dev.akinaza.com" };
    const seen: { url: string; auth: string; body: URLSearchParams }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      seen.push({ url, auth: (init.headers as Record<string, string>).Authorization!, body: init.body as URLSearchParams });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    // Only this journey's mails: CI's database is shared by the integration files running in parallel (akinaza#341).
    const ours = (await query<{ id: string }>("SELECT id FROM mail_outbox WHERE related_id = $1 AND status = 'pending'", [ids.report])).map((m) => m.id);
    const stillPending = await flushOutbox(db(), new Date(), mailgun, ok, { ids: ours });
    expect(stillPending.sent).toBeGreaterThanOrEqual(1); // the earlier, unconfigured mail goes out now
    seen.length = 0;
    const sent = await sendWalkReport(db(), (await query<{ id: string }>("SELECT id FROM shops WHERE slug = $1", [`pattes-${stamp}`]))[0]!.id, ids.booking!, new Date(), mailgun, ok);
    expect(sent.status).toBe("sent");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe("https://api.mailgun.net/v3/mg.example.test/messages");
    expect(seen[0]!.auth).toBe(`Basic ${Buffer.from("api:key-secret-1").toString("base64")}`);
    expect(seen[0]!.body.get("to")).toBe(accounts.client.email);
    expect(seen[0]!.body.get("from")).toBe("Akinaza <no-reply@mg.example.test>");
    expect(seen[0]!.body.get("text")).not.toContain("key-secret-1");
    ids.token = /report\/(rp1\.[A-Za-z0-9_-]{43})/.exec(seen[0]!.body.get("text")!)?.[1];
    const [row] = await query<{ status: string; sent_at: Date | null }>("SELECT status, sent_at FROM mail_outbox WHERE id = $1", [sent.mailId]);
    expect(row!.status).toBe("sent");
    const [report] = await query<{ sent_at: Date | null }>("SELECT sent_at FROM visit_reports WHERE id = $1", [ids.report]);
    expect(report!.sent_at).not.toBeNull();
    const down = (async () => new Response("no", { status: 503 })) as unknown as typeof fetch;
    const shopId = (await query<{ id: string }>("SELECT id FROM shops WHERE slug = $1", [`pattes-${stamp}`]))[0]!.id;
    const statuses: string[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await sendWalkReport(db(), shopId, ids.booking!, new Date(), mailgun, down)).status);
    expect(statuses).toEqual(["pending", "pending", "pending", "pending", "pending"]); // each send is a new mail with its first attempt
    const failing = await query<{ id: string }>("SELECT id FROM mail_outbox WHERE related_id = $1 AND status = 'pending'", [ids.report]);
    for (let i = 0; i < 4; i++) await flushOutbox(db(), new Date(), mailgun, down, { ids: failing.map((m) => m.id) });
    expect(await query("SELECT 1 FROM mail_outbox WHERE related_id = $1 AND status = 'failed'", [ids.report])).toHaveLength(failing.length);
    // The last successful link is gone with the failed sends' rotation; take a good one again.
    ids.token = undefined;
    const again = await sendWalkReport(db(), shopId, ids.booking!, new Date(), mailgun, ((async (_u: string, init: RequestInit) => {
      ids.token = /report\/(rp1\.[A-Za-z0-9_-]{43})/.exec((init.body as URLSearchParams).get("text")!)?.[1];
      return new Response("{}", { status: 200 });
    }) as unknown) as typeof fetch);
    expect(again.status).toBe("sent");
    expect(ids.token).toBeTruthy();
  });

  it("opens the access notes for the walker alone, and writes it in the audit log", async () => {
    const asClient = { params: { id: ids.clientFile! } };
    expect((await call(revealNotes, "GET", "/x", { token: walker, ...asClient })).body).toEqual({ notes: "Code 4821, clé sous le pot" });
    expect((await call(revealNotes, "GET", "/x", { token: client, ...asClient })).status).toBe(403);
    expect((await call(revealNotes, "GET", "/x", { token: stranger, ...asClient })).status).toBe(403);
    const trail = await query("SELECT 1 FROM audit_log WHERE action = 'client.access_notes_read' AND target_id = $1", [ids.clientFile]);
    expect(trail).toHaveLength(1);
  });

  it("gives the client their data and erases it on request — the private link dies with it", async () => {
    expect((await call(reportPhoto, "GET", `/api/report/${ids.token}/photo`, { params: { token: ids.token! } })).status).toBe(200);
    const data = await call(exportData, "GET", `/api/me/export?clientId=${ids.clientFile}`, { token: client });
    expect(data.body.file).toMatchObject({ fullName: "Camille Tremblay", accessNotes: "Code 4821, clé sous le pot" });
    expect(data.body.dependants[0]).toMatchObject({ name: "Rex" });
    expect((await call(exportData, "GET", `/api/me/export?clientId=${ids.clientFile}`, { token: other })).status).toBe(404);
    expect((await call(erase, "POST", "/api/me/erase", { token: client, json: { clientId: ids.clientFile, confirmEmail: "someone@else.test" } })).body).toMatchObject({ code: "CONFIRM_MISMATCH" });
    expect((await call(erase, "POST", "/api/me/erase", { token: client, json: { clientId: ids.clientFile, confirmEmail: accounts.client.email.toUpperCase() } })).status).toBe(200);
    expect((await call(reportPhoto, "GET", `/api/report/${ids.token}/photo`, { params: { token: ids.token! } })).status).toBe(404);
    expect(await query("SELECT 1 FROM mail_outbox WHERE related_id = $1", [ids.report])).toHaveLength(0);
    expect((await call(exportData, "GET", `/api/me/export?clientId=${ids.clientFile}`, { token: client })).status).toBe(404);
    const [dog] = await query<{ name: string }>("SELECT name FROM dependants WHERE id = $1", [ids.dog]);
    expect(dog!.name).toBe("—");
    expect(db()).toBeTruthy();
  });
  it("slows a public caller down (429 with Retry-After) and leaks nothing about the owner on the slots answer", async () => {
    const some = (await query<{ id: string }>("SELECT id FROM services WHERE shop_id = $1 LIMIT 1", [ids.shop]))[0]!.id;
    const path = `/api/shops/pattes-${stamp}/slots?serviceId=${some}&zoneId=`;
    const first = await call(slots, "GET", path, { params: { slug: `pattes-${stamp}` } });
    expect(first.status).toBe(200);
    expect(JSON.stringify(first.body)).not.toMatch(/owner|email|phone|address|accessNotes|clientId/i);
    let last = first;
    for (let i = 0; i < 125 && last.status !== 429; i += 1) last = await call(slots, "GET", path, { params: { slug: `pattes-${stamp}` } });
    expect(last.status).toBe(429);
    expect(last.res.headers.get("retry-after")).toMatch(/^\d+$/);
  }, 30_000); // up to 125 calls against the database: slow on a busy CI runner
});
