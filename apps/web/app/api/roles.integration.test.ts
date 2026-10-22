import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as acceptInvite } from "./auth/accept-invite/route";
import { GET as accessNotes } from "./walker/clients/[id]/access-notes/route";
import { POST as dayOff } from "./walker/days-off/route";
import { POST as hours } from "./walker/hours/route";
import { POST as invoices } from "./walker/invoices/route";
import { POST as rules } from "./walker/rules/route";
import { POST as services } from "./walker/services/route";
import { POST as saveShop } from "./walker/shop/route";
import { DELETE as revokeInvitation } from "./walker/team/invitations/[id]/route";
import { POST as invite } from "./walker/team/invitations/route";
import { DELETE as removeMember, PATCH as changeRole } from "./walker/team/members/[accountId]/route";
import { GET as teamOf } from "./walker/team/route";
import { POST as checkIn } from "./walker/visits/[id]/check-in/route";
import { GET as listHooks } from "./walker/webhooks/route";
import { POST as zones } from "./walker/zones/route";

/** The roles of a shop over HTTP, on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { cookie?: string; json?: unknown; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = `${SESSION_COOKIE}=${opts.cookie}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }), { params: Promise.resolve((opts.params ?? {}) as never) });
  return { status: res.status, body: (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : null };
}

describe.runIf(enabled)("roles of a shop over HTTP", () => {
  const stamp = Date.now();
  const sessions: Record<string, string> = {};
  const accounts: Record<string, { id: string; email: string }> = {};
  const UUID = "00000000-0000-4000-8000-000000000001";
  const make = async (label: string) => {
    const email = `${label}-${stamp}@akinaza.test`;
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [email]);
    accounts[label] = { id: row!.id, email };
    sessions[label] = (await createSession(row!.id, { ip: null, userAgent: "vitest" })).token;
  };
  /** Invites `label` with `role` as `by`, and has them accept. */
  const join = async (by: string, label: string, role: string) => {
    const sent = await call(invite, "POST", "/api/walker/team/invitations", { cookie: sessions[by], json: { email: accounts[label]!.email, role } });
    expect(sent.status).toBe(201);
    const token = new URL(sent.body.link).searchParams.get("token")!;
    expect((await call(acceptInvite, "POST", "/api/auth/accept-invite", { cookie: sessions[label], json: { token } })).body).toMatchObject({ role });
  };
  let shopId: string;

  beforeAll(async () => {
    await migrate();
    for (const label of ["owner", "manager", "camille", "stranger", "second"]) await make(label);
    await call(saveShop, "POST", "/api/walker/shop", { cookie: sessions.owner, json: { name: "Cèdre & Ciseaux (test)", legalName: "Cèdre (test)", address: "1 rue Test", slug: `cedre-${stamp}`, ownerName: "Maëlle" } });
    shopId = (await query<{ id: string }>("SELECT id FROM shops WHERE slug = $1", [`cedre-${stamp}`]))[0]!.id;
    await join("owner", "manager", "manager");
    await join("manager", "camille", "staff");
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  it("the shop's owner is its owner member (made by the database), and the team is told", async () => {
    expect(await query("SELECT 1 FROM memberships WHERE scope_id = $1 AND account_id = $2 AND role = 'owner'", [shopId, accounts.owner!.id])).toHaveLength(1);
    const t = (await call(teamOf, "GET", "/api/walker/team", { cookie: sessions.owner })).body;
    expect(t.members.map((m: { email: string; role: string }) => [m.email, m.role])).toEqual([[accounts.owner!.email, "owner"], [accounts.manager!.email, "manager"], [accounts.camille!.email, "staff"]]);
    expect(t.permissions.staff).toEqual(["agenda", "checkin", "visit-reports", "access-notes"]);
  });

  // What each role may reach — one parametrised table over the routes, status 403 = refused by the role, anything else = let through.
  type Probe = [name: string, handler: unknown, method: string, path: string, body: unknown, params?: Record<string, string>];
  const probes: Probe[] = [
    ["settings: the rules", rules, "POST", "/api/walker/rules", {}],
    ["settings: the webhooks", listHooks, "GET", "/api/walker/webhooks", undefined],
    ["catalogue: zones", zones, "POST", "/api/walker/zones", { name: "Z" }],
    ["catalogue: services", services, "POST", "/api/walker/services", {}],
    ["schedule: hours", hours, "POST", "/api/walker/hours", {}],
    ["schedule: days off", dayOff, "POST", "/api/walker/days-off", {}],
    ["invoices", invoices, "POST", "/api/walker/invoices", {}],
    ["team", teamOf, "GET", "/api/walker/team", undefined],
    ["access notes", accessNotes, "GET", `/api/walker/clients/${UUID}/access-notes`, undefined, { id: UUID }],
    ["check-in", checkIn, "POST", `/api/walker/visits/${UUID}/check-in`, {}, { id: UUID }],
  ];
  const allowed: Record<string, string[]> = {
    owner: probes.map((p) => p[0]),
    manager: ["catalogue: zones", "catalogue: services", "schedule: hours", "schedule: days off", "invoices", "team", "access notes", "check-in"],
    staff: ["access notes", "check-in"],
  };
  describe.each(["owner", "manager", "staff"])("%s", (role) => {
    it.each(probes.map((p) => [p[0], p] as const))("%s", async (_name, [name, handler, method, path, body, params]) => {
      const label = role === "staff" ? "camille" : role;
      const res = await call(handler, method, path, { cookie: sessions[label], json: body, params });
      if (allowed[role]!.includes(name)) expect(res.status, `${role} → ${name}`).not.toBe(403);
      else expect(res.body, `${role} → ${name}`).toMatchObject({ code: "FORBIDDEN" });
    });
  });

  it("a person who belongs to no shop is refused; a shop one is not a member of is not found", async () => {
    expect((await call(zones, "POST", "/api/walker/zones", { cookie: sessions.stranger, json: { name: "Z" } })).body).toMatchObject({ code: "NO_SHOP" });
    expect((await call(teamOf, "GET", `/api/walker/team?shopId=${shopId}`, { cookie: sessions.stranger })).status).toBe(404);
    expect((await call(teamOf, "GET", `/api/walker/team?shopId=${shopId}`, { cookie: sessions.manager })).status).toBe(200);
  });

  it("an invitation goes to one address, once: another account cannot take it, a second use fails, a manager cannot hand out manager", async () => {
    const asManager = await call(invite, "POST", "/api/walker/team/invitations", { cookie: sessions.manager, json: { email: accounts.second!.email, role: "manager" } });
    expect(asManager.body.code).toBe("ROLE_NOT_ALLOWED");
    const sent = await call(invite, "POST", "/api/walker/team/invitations", { cookie: sessions.manager, json: { email: accounts.second!.email, role: "staff" } });
    const token = new URL(sent.body.link).searchParams.get("token")!;
    expect((await query("SELECT 1 FROM mail_outbox WHERE to_email = $1 AND template = 'team-invitation'", [accounts.second!.email])).length).toBeGreaterThan(0);
    expect((await call(acceptInvite, "POST", "/api/auth/accept-invite", { cookie: sessions.stranger, json: { token } })).body.code).toBe("INVITE_WRONG_ACCOUNT");
    expect((await call(acceptInvite, "POST", "/api/auth/accept-invite", { cookie: sessions.second, json: { token } })).status).toBe(200);
    expect((await call(acceptInvite, "POST", "/api/auth/accept-invite", { cookie: sessions.second, json: { token } })).body.code).toBe("INVITE_INVALID");
    expect((await call(invite, "POST", "/api/walker/team/invitations", { cookie: sessions.camille, json: { email: "x@example.test", role: "staff" } })).body.code).toBe("FORBIDDEN");
    const again = await call(invite, "POST", "/api/walker/team/invitations", { cookie: sessions.owner, json: { email: `later-${stamp}@akinaza.test`, role: "staff" } });
    expect((await call(revokeInvitation, "DELETE", "/x", { cookie: sessions.owner, params: { id: again.body.invitation.id } })).status).toBe(200);
  });

  it("roles change within what the actor hands out, members leave or are removed, and the last owner stays — every change audited", async () => {
    const [m, c, o] = [accounts.manager!.id, accounts.camille!.id, accounts.owner!.id];
    expect((await call(changeRole, "PATCH", "/x", { cookie: sessions.manager, params: { accountId: c }, json: { role: "manager" } })).body.code).toBe("ROLE_NOT_ALLOWED");
    expect((await call(changeRole, "PATCH", "/x", { cookie: sessions.owner, params: { accountId: o }, json: { role: "manager" } })).body.code).toBe("LAST_OWNER");
    expect((await call(removeMember, "DELETE", "/x", { cookie: sessions.owner, params: { accountId: o } })).body.code).toBe("LAST_OWNER");
    expect((await call(changeRole, "PATCH", "/x", { cookie: sessions.owner, params: { accountId: m }, json: { role: "owner" } })).status).toBe(200);
    expect((await call(removeMember, "DELETE", "/x", { cookie: sessions.manager, params: { accountId: c } })).status).toBe(200); // the new owner removes staff
    expect((await call(zones, "POST", "/api/walker/zones", { cookie: sessions.camille, json: { name: "Z" } })).body.code).toBe("NO_SHOP");
    const trail = await query<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'team.%' AND actor_label LIKE $1", [`%-${stamp}@akinaza.test`]);
    expect(new Set(trail.map((t) => t.action))).toEqual(new Set(["team.invited", "team.joined", "team.role_changed", "team.member_removed", "team.invitation_revoked"]));
  });
});
