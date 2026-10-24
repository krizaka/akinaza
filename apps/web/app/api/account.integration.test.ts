import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrate, pool, query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";
import { appSettings } from "@/lib/settings";

import { POST as confirmEmail } from "./auth/confirm-email/route";
import { POST as forgotPassword } from "./auth/password/forgot/route";
import { POST as resetPassword } from "./auth/password/reset/route";
import { GET as exportAccount } from "./me/account-export/route";
import { POST as deleteAccount } from "./me/delete/route";
import { POST as changeEmail } from "./me/email/route";
import { POST as changePassword } from "./me/password/route";
import { GET as getProfile, PATCH as patchProfile } from "./me/profile/route";
import { GET as listSessions } from "./me/sessions/route";
import { POST as signOutOthers } from "./me/sessions/sign-out-others/route";
import { POST as saveShop } from "./walker/shop/route";

/** The account baseline over HTTP, on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
const PASSWORD = "correct-horse-battery";
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { cookie?: string; json?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = `${SESSION_COOKIE}=${opts.cookie}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }), { params: Promise.resolve({} as never) });
  return { status: res.status, body: (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : null, res };
}

describe.runIf(enabled)("the account baseline over HTTP", () => {
  // Unique across test files run in parallel: two files starting in the same millisecond collided on accounts_email_unique.
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const made: string[] = [];
  const account = async (label: string) => {
    const email = `${label}-${stamp}@akinaza.test`;
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, $2) RETURNING id", [email, await hashPassword(PASSWORD)]);
    made.push(email);
    const first = await createSession(row!.id, { ip: "203.0.113.5", userAgent: "vitest-a" });
    return { id: row!.id, email, token: first.token };
  };
  beforeAll(async () => {
    await migrate();
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email = ANY($1) OR email LIKE $2", [made, `%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  it("is for signed-in members only", async () => {
    expect((await call(getProfile, "GET", "/api/me/profile")).status).toBe(401);
    expect((await call(listSessions, "GET", "/api/me/sessions")).status).toBe(401);
    expect((await call(deleteAccount, "POST", "/api/me/delete", { json: { password: PASSWORD } })).status).toBe(401);
  });

  it("reads and updates the profile: name, language, theme, avatar", async () => {
    const a = await account("profile");
    expect((await call(getProfile, "GET", "/api/me/profile", { cookie: a.token })).body.profile).toMatchObject({ email: a.email, name: null, theme: null, emailVerified: false });
    const patched = await call(patchProfile, "PATCH", "/api/me/profile", { cookie: a.token, json: { name: " Éric  Tremblay ", locale: "en", theme: "dark", avatarSeed: "plain-2" } });
    expect(patched.body.profile).toMatchObject({ name: "Éric Tremblay", locale: "en", theme: "dark", avatarSeed: "plain-2" });
    expect((await call(patchProfile, "PATCH", "/api/me/profile", { cookie: a.token, json: { theme: "neon" } })).status).toBe(400);
  });

  it("changes the e-mail by a link to the new address: queued in the outbox, verified by the link, once", async () => {
    const a = await account("mail");
    const next = `next-${stamp}@akinaza.test`;
    made.push(next);
    expect((await call(changeEmail, "POST", "/api/me/email", { cookie: a.token, json: { newEmail: next, password: "wrong" } })).status).toBe(403);
    expect((await call(changeEmail, "POST", "/api/me/email", { cookie: a.token, json: { newEmail: next, password: PASSWORD } })).status).toBe(200);
    const [mail] = await query<{ to_email: string; body_text: string; locale: string }>("SELECT to_email, body_text, locale FROM mail_outbox WHERE to_email = $1", [next]);
    expect(mail).toMatchObject({ to_email: next, locale: "fr" });
    const token = /token=(ae1\.[A-Za-z0-9_-]+)/.exec(decodeURIComponent(mail!.body_text))![1]!;
    expect((await call(getProfile, "GET", "/api/me/profile", { cookie: a.token })).body.profile.pendingEmail).toBe(next);
    expect((await call(confirmEmail, "POST", "/api/auth/confirm-email", { json: { token } })).status).toBe(200);
    expect((await call(getProfile, "GET", "/api/me/profile", { cookie: a.token })).body.profile).toMatchObject({ email: next, emailVerified: true, pendingEmail: null });
    expect((await call(confirmEmail, "POST", "/api/auth/confirm-email", { json: { token } })).status).toBe(400);
  });

  it("resets a forgotten password by a mailed link whose lifetime is the setting, used once even when two tries race", async () => {
    const a = await account("reset");
    const admin = { id: null, label: "vitest" };
    await appSettings().set(admin, { scope: "global", id: "" }, "auth.passwordResetTtlMinutes", 45, new Date());
    try {
      expect((await call(forgotPassword, "POST", "/api/auth/password/forgot", { json: { email: `nobody-${stamp}@akinaza.test` } })).status).toBe(202);
      expect((await call(forgotPassword, "POST", "/api/auth/password/forgot", { json: { email: a.email } })).status).toBe(202);
      const [mail] = await query<{ body_text: string; template: string }>("SELECT body_text, template FROM mail_outbox WHERE to_email = $1 ORDER BY created_at DESC LIMIT 1", [a.email]);
      expect(mail!.template).toBe("password-reset");
      expect(mail!.body_text).toContain("45 min");
      const [link] = await query<{ minutes: number }>("SELECT round(extract(epoch FROM expires_at - created_at) / 60)::int AS minutes FROM password_resets WHERE account_id = $1 AND used_at IS NULL", [a.id]);
      expect(link!.minutes).toBe(45);
      const token = /token=(ae1\.[A-Za-z0-9_-]+)/.exec(decodeURIComponent(mail!.body_text))![1]!;
      const tries = await Promise.all([1, 2].map(() => call(resetPassword, "POST", "/api/auth/password/reset", { json: { token, password: "a-brand-new-password" } })));
      expect(tries.map((t) => t.status).sort()).toEqual([200, 400]);
      expect((await call(listSessions, "GET", "/api/me/sessions", { cookie: a.token })).status).toBe(401);
    } finally {
      await appSettings().reset(admin, { scope: "global", id: "" }, "auth.passwordResetTtlMinutes", new Date());
    }
  });

  it("lists the sign-ins, signs the others out, and changing the password does the same", async () => {
    const a = await account("sess");
    await createSession(a.id, { ip: "198.51.100.7", userAgent: "vitest-b" });
    const list = (await call(listSessions, "GET", "/api/me/sessions", { cookie: a.token })).body.sessions as { current: boolean; ip: string }[];
    expect(list).toHaveLength(2);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    expect(JSON.stringify(list)).not.toMatch(/token/i);
    expect((await call(signOutOthers, "POST", "/api/me/sessions/sign-out-others", { cookie: a.token })).body.signedOut).toBe(1);
    await createSession(a.id, { ip: null, userAgent: null });
    expect((await call(changePassword, "POST", "/api/me/password", { cookie: a.token, json: { current: "wrong", next: "another-long-password" } })).status).toBe(403);
    expect((await call(changePassword, "POST", "/api/me/password", { cookie: a.token, json: { current: PASSWORD, next: "another-long-password" } })).status).toBe(200);
    expect((await call(listSessions, "GET", "/api/me/sessions", { cookie: a.token })).body.sessions).toHaveLength(1);
  });

  it("exports the member's data (the shops they run too) and deletes the account after the password — the shop's books stay", async () => {
    const a = await account("gone");
    const shop = (await call(saveShop, "POST", "/api/walker/shop", { cookie: a.token, json: { name: "À moi", legalName: "À moi", address: "1 rue Test", slug: `a-moi-${stamp}`, ownerName: "Éric" } })).body.shopId as string;
    const out = await call(exportAccount, "GET", "/api/me/account-export", { cookie: a.token });
    expect(out.res.headers.get("content-disposition")).toContain("akinaza-account.json");
    expect(out.body).toMatchObject({ account: { email: a.email }, shops: [{ id: shop, name: "À moi" }], clientFiles: [] });
    expect(JSON.stringify(out.body)).not.toMatch(/password_hash|token_hash/);
    expect((await call(deleteAccount, "POST", "/api/me/delete", { cookie: a.token, json: { password: "nope" } })).status).toBe(403);
    expect((await call(deleteAccount, "POST", "/api/me/delete", { cookie: a.token, json: { password: PASSWORD } })).status).toBe(200);
    expect(await query("SELECT 1 FROM accounts WHERE id = $1", [a.id])).toHaveLength(0);
    expect((await call(getProfile, "GET", "/api/me/profile", { cookie: a.token })).status).toBe(401);
    expect(await query("SELECT 1 FROM shops WHERE id = $1 AND owner_id IS NULL", [shop])).toHaveLength(1);
  });
});
