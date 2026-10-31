import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

import { POST as code } from "./shops/[slug]/guest/code/route";
import { POST as confirm } from "./shops/[slug]/guest/confirm/route";
import { GET as slots } from "./shops/[slug]/slots/route";
import { apiCall, closeSuite, openBookableShop, testAccount } from "./test-api";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined), set: (c: { name: string; value: string }) => void jar.set(c.name, c.value) }), headers: async () => new Headers() }));

/** A visitor books with no account: the code mailed to them, then the booking and the session (krizaka-internal#1909), on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("booking as a guest", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const slug = `guest-${randomUUID().slice(0, 8)}`;
  const mails: { to: string; text: string }[] = [];
  let service = "";
  let zone = "";
  let startsAt = "";

  const start = (email: string, extra: Record<string, unknown> = {}) => ({ serviceId: service, zoneId: zone, startsAt, fullName: "Camille Roy", email, phone: "514-555-0100", language: "en", consentService: true, consentReminders: false, ...extra });
  const codeIn = (to: string) => /\b(\d{6})\b/.exec(mails.filter((m) => m.to === to).at(-1)?.text ?? "")?.[1] ?? "";

  beforeAll(async () => {
    await migrate();
    vi.stubEnv("MAIL_PROVIDER", "mailgun");
    vi.stubEnv("MAIL_API_KEY", "test-mail-key");
    vi.stubEnv("MAIL_DOMAIN", "mg.test.example");
    vi.stubGlobal("fetch", async (_url: string, init: { body: URLSearchParams }) => {
      mails.push({ to: init.body.get("to") ?? "", text: init.body.get("text") ?? "" });
      return new Response("{}", { status: 200 });
    });
    const owner = await testAccount("guest-owner", stamp);
    const shop = await openBookableShop(owner.token, `Guest ${stamp}`, slug);
    service = shop.service;
    zone = shop.zone;
    const offered = await apiCall(slots, "GET", `/api/shops/${slug}/slots?serviceId=${service}&zoneId=${zone}`, { params: { slug } });
    startsAt = offered.body.slots[0].startsAt;
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await closeSuite(stamp);
  });

  it("refuses a request without the booking consent, and a service that is not the shop's", async () => {
    const email = `no-consent-${stamp}@akinaza.test`;
    expect((await apiCall(code, "POST", `/api/shops/${slug}/guest/code`, { params: { slug }, json: start(email, { consentService: false }) })).status).toBe(400);
    expect((await apiCall(code, "POST", `/api/shops/${slug}/guest/code`, { params: { slug }, json: start(email, { serviceId: randomUUID() }) })).status).toBe(404);
    expect(mails.filter((m) => m.to === email)).toEqual([]);
  });

  it("mails a code, books and signs in only for the right code — once — and keeps no code in the outbox", async () => {
    const email = `visitor-${stamp}@akinaza.test`;
    const sent = await apiCall(code, "POST", `/api/shops/${slug}/guest/code`, { params: { slug }, json: start(email, { fullName: "Camille Roy" }) });
    expect(sent.status).toBe(201);
    const secret = codeIn(email);
    expect(secret).toMatch(/^\d{6}$/);
    const outbox = await query<{ html: string; body_text: string; status: string }>("SELECT html, body_text, status FROM mail_outbox WHERE to_email = $1", [email]);
    expect(outbox).toEqual([{ html: "", body_text: "", status: "sent" }]);
    expect(await query("SELECT 1 FROM clients WHERE email = $1", [email])).toEqual([]);

    const wrong = await apiCall(confirm, "POST", `/api/shops/${slug}/guest/confirm`, { params: { slug }, json: { challengeId: sent.body.challengeId, email, code: secret === "000000" ? "111111" : "000000" } });
    expect(wrong).toMatchObject({ status: 400, body: { code: "CODE_INVALID", attemptsLeft: 4 } });
    const otherAddress = await apiCall(confirm, "POST", `/api/shops/${slug}/guest/confirm`, { params: { slug }, json: { challengeId: sent.body.challengeId, email: `thief-${stamp}@akinaza.test`, code: secret } });
    expect(otherAddress.status).toBe(400);

    const done = await apiCall(confirm, "POST", `/api/shops/${slug}/guest/confirm`, { params: { slug }, json: { challengeId: sent.body.challengeId, email, code: secret } });
    expect(done.status).toBe(201);
    expect(done.body.bookingId).toMatch(/^[0-9a-f-]{36}$/);
    expect([...jar.keys()].some((name) => name.includes("session"))).toBe(true);
    const booked = await query<{ full_name: string; consent: boolean }>("SELECT c.full_name, EXISTS (SELECT 1 FROM privacy.consent k WHERE k.subject_id = c.id::text AND k.purpose = 'service' AND k.granted) AS consent FROM clients c WHERE c.email = $1", [email]);
    expect(booked).toEqual([{ full_name: "Camille Roy", consent: true }]);
    const account = await query<{ password_hash: string | null; email_verified_at: string | null }>("SELECT password_hash, email_verified_at FROM accounts WHERE email = $1", [email]);
    expect(account[0]!.password_hash).toBeNull();
    expect(account[0]!.email_verified_at).not.toBeNull();

    const again = await apiCall(confirm, "POST", `/api/shops/${slug}/guest/confirm`, { params: { slug }, json: { challengeId: sent.body.challengeId, email, code: secret } });
    expect(again).toMatchObject({ status: 410, body: { code: "CODE_EXPIRED" } });
  });

  it("locks a challenge after five wrong codes, even for the right one", async () => {
    const email = `locked-${stamp}@akinaza.test`;
    const sent = await apiCall(code, "POST", `/api/shops/${slug}/guest/code`, { params: { slug }, json: start(email) });
    const secret = codeIn(email);
    const bad = secret === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) await apiCall(confirm, "POST", `/api/shops/${slug}/guest/confirm`, { params: { slug }, json: { challengeId: sent.body.challengeId, email, code: bad } });
    const late = await apiCall(confirm, "POST", `/api/shops/${slug}/guest/confirm`, { params: { slug }, json: { challengeId: sent.body.challengeId, email, code: secret } });
    expect(late.status).toBeGreaterThanOrEqual(410);
    expect(await query("SELECT 1 FROM clients WHERE email = $1", [email])).toEqual([]);
  });

  it("limits the codes mailed to one address, so a mailbox cannot be flooded", async () => {
    const email = `flood-${stamp}@akinaza.test`;
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await apiCall(code, "POST", `/api/shops/${slug}/guest/code`, { params: { slug }, json: start(email) })).status);
    expect(statuses).toEqual([201, 201, 201, 429]);
    expect(mails.filter((m) => m.to === email)).toHaveLength(3);
  });

  it("sends a person who already has a password to sign in, and opens nothing", async () => {
    const owner = await testAccount("has-password", stamp);
    const sent = await apiCall(code, "POST", `/api/shops/${slug}/guest/code`, { params: { slug }, json: start(owner.email) });
    const done = await apiCall(confirm, "POST", `/api/shops/${slug}/guest/confirm`, { params: { slug }, json: { challengeId: sent.body.challengeId, email: owner.email, code: codeIn(owner.email) } });
    expect(done).toMatchObject({ status: 409, body: { code: "SIGN_IN_REQUIRED" } });
    expect(await query("SELECT 1 FROM clients WHERE account_id = $1", [owner.id])).toEqual([]);
  });

  it("fails closed when no mail channel is configured", async () => {
    vi.stubEnv("MAIL_PROVIDER", "none");
    const res = await apiCall(code, "POST", `/api/shops/${slug}/guest/code`, { params: { slug }, json: start(`closed-${stamp}@akinaza.test`) });
    expect(res).toMatchObject({ status: 503, body: { code: "MAIL_UNAVAILABLE" } });
    vi.stubEnv("MAIL_PROVIDER", "mailgun");
  });
});
