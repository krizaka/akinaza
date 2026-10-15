import { audit } from "./audit";
import { pool, query } from "./db";
import { refuse } from "./http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID.test(value);

export interface Overview {
  accounts: number;
  admins: number;
  suspended: number;
  shops: number;
  clients: number;
  appointmentsToday: number;
  invoices: number;
}

/** The administration's counts — metadata only, never a client's file or an invoice's content. */
export async function overview(): Promise<Overview> {
  const [row] = await query<Record<keyof Overview, string>>(
    `SELECT (SELECT count(*) FROM accounts) AS accounts,
            (SELECT count(*) FROM accounts WHERE role = 'ADMIN') AS admins,
            (SELECT count(*) FROM accounts WHERE status = 'SUSPENDED') AS suspended,
            (SELECT count(*) FROM shops) AS shops,
            (SELECT count(*) FROM clients WHERE erased_at IS NULL) AS clients,
            (SELECT count(*) FROM appointments WHERE lower(during)::date = current_date AND status <> 'cancelled') AS "appointmentsToday",
            (SELECT count(*) FROM invoices) AS invoices`,
  );
  const n = (k: keyof Overview) => Number(row?.[k] ?? 0);
  return { accounts: n("accounts"), admins: n("admins"), suspended: n("suspended"), shops: n("shops"), clients: n("clients"), appointmentsToday: n("appointmentsToday"), invoices: n("invoices") };
}

// ── People ───────────────────────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  shops: number;
  createdAt: string;
  lastSeenAt: string | null;
}

/** Every account (the last 500), searchable on the client. Never a prediction: who an account is and in what state. */
export async function listUsers(): Promise<AdminUser[]> {
  const rows = await query<{ id: string; email: string; role: "USER" | "ADMIN"; status: "ACTIVE" | "SUSPENDED"; shops: string; created_at: Date; last_seen_at: Date | null }>(
    `SELECT a.id, a.email, a.role, a.status, a.created_at, a.last_seen_at, (SELECT count(*) FROM shops s WHERE s.owner_id = a.id) AS shops
       FROM accounts a ORDER BY a.created_at DESC LIMIT 500`,
  );
  return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, status: r.status, shops: Number(r.shops), createdAt: r.created_at.toISOString(), lastSeenAt: r.last_seen_at?.toISOString() ?? null }));
}

export interface UserDetail extends AdminUser {
  sessions: number;
}

export async function userDetail(id: string): Promise<UserDetail> {
  if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such account");
  const [r] = await query<{ id: string; email: string; role: "USER" | "ADMIN"; status: "ACTIVE" | "SUSPENDED"; created_at: Date; last_seen_at: Date | null; shops: string; sessions: string }>(
    `SELECT a.id, a.email, a.role, a.status, a.created_at, a.last_seen_at,
            (SELECT count(*) FROM shops s WHERE s.owner_id = a.id) AS shops,
            (SELECT count(*) FROM sessions s WHERE s.account_id = a.id AND s.expires_at > now()) AS sessions
       FROM accounts a WHERE a.id = $1`,
    [id],
  );
  if (!r) throw refuse(404, "NOT_FOUND", "No such account");
  return { id: r.id, email: r.email, role: r.role, status: r.status, shops: Number(r.shops), sessions: Number(r.sessions), createdAt: r.created_at.toISOString(), lastSeenAt: r.last_seen_at?.toISOString() ?? null };
}

export type Actor = { id: string; email: string };

/** Suspends (every session ends at once) or restores an account. Never your own. */
export async function setUserStatus(actor: Actor, id: string, status: "ACTIVE" | "SUSPENDED", headers?: Headers): Promise<UserDetail> {
  if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such account");
  if (status === "SUSPENDED" && id === actor.id) throw refuse(409, "SELF_SUSPEND", "You cannot suspend your own account");
  const rows = await query("UPDATE accounts SET status = $2 WHERE id = $1 RETURNING id", [id, status]);
  if (rows.length === 0) throw refuse(404, "NOT_FOUND", "No such account");
  if (status === "SUSPENDED") await query("DELETE FROM sessions WHERE account_id = $1", [id]);
  await audit({ action: status === "SUSPENDED" ? "admin.user_suspended" : "admin.user_restored", actorId: actor.id, actorLabel: actor.email, targetId: id, headers });
  return userDetail(id);
}

/** Who may be given which role — pure, shared by the route and the tests. Returns a refusal or null. */
export function roleChangeRefusal(actorId: string, targetId: string, to: "USER" | "ADMIN", adminsLeft: number, currentRole: "USER" | "ADMIN"): { code: string; message: string } | null {
  if (to === currentRole) return null;
  if (actorId === targetId) return { code: "SELF_ROLE", message: "You cannot change your own role" };
  if (currentRole === "ADMIN" && to === "USER" && adminsLeft <= 1) return { code: "LAST_ADMIN", message: "The last administrator keeps the role" };
  return null;
}

const activeAdmins = async () => Number((await query<{ n: string }>("SELECT count(*) AS n FROM accounts WHERE role = 'ADMIN' AND status = 'ACTIVE'"))[0]?.n ?? 0);

export async function setUserRole(actor: Actor, id: string, to: "USER" | "ADMIN", headers?: Headers): Promise<UserDetail> {
  const current = await userDetail(id);
  const refusal = roleChangeRefusal(actor.id, id, to, await activeAdmins(), current.role);
  if (refusal) throw refuse(409, refusal.code, refusal.message);
  if (to !== current.role) {
    await query("UPDATE accounts SET role = $2 WHERE id = $1", [id, to]);
    await audit({ action: "admin.user_role_changed", actorId: actor.id, actorLabel: actor.email, targetId: id, detail: { from: current.role, to }, headers });
  }
  return userDetail(id);
}

/** Ends every session of an account without suspending it. */
export async function revokeUserSessions(actor: Actor, id: string, headers?: Headers): Promise<{ revoked: number; user: UserDetail }> {
  await userDetail(id);
  const rows = await query("DELETE FROM sessions WHERE account_id = $1 RETURNING id", [id]);
  await audit({ action: "admin.sessions_revoked", actorId: actor.id, actorLabel: actor.email, targetId: id, detail: { count: rows.length }, headers });
  return { revoked: rows.length, user: await userDetail(id) };
}

/**
 * Law 25 portability: the account (never its password hash), the shops it owns, its sessions' addresses and the audit
 * trail that names it. A shop's clients and invoices are the merchant's records, not the account's: they are not here.
 */
export async function exportAccount(actor: Actor, id: string, headers?: Headers): Promise<Record<string, unknown>> {
  const user = await userDetail(id);
  const shops = await query<{ id: string; name: string; legal_name: string; kind: string; registrant: boolean; created_at: Date }>("SELECT id, name, legal_name, kind, registrant, created_at FROM shops WHERE owner_id = $1 ORDER BY created_at", [id]);
  const sessions = await query<{ created_at: Date; expires_at: Date; ip: string | null; user_agent: string | null }>("SELECT created_at, expires_at, ip, user_agent FROM sessions WHERE account_id = $1 ORDER BY created_at", [id]);
  const trail = await auditLog(1000, id);
  await audit({ action: "admin.account_exported", actorId: actor.id, actorLabel: actor.email, targetId: id, detail: { shops: shops.length }, headers });
  return {
    format: "akinaza-account-export/1",
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, role: user.role, status: user.status, createdAt: user.createdAt, lastSeenAt: user.lastSeenAt },
    shops: shops.map((s) => ({ id: s.id, name: s.name, legalName: s.legal_name, kind: s.kind, registrant: s.registrant, createdAt: s.created_at.toISOString() })),
    sessions: sessions.map((s) => ({ createdAt: s.created_at.toISOString(), expiresAt: s.expires_at.toISOString(), ip: s.ip, userAgent: s.user_agent })),
    audit: trail,
  };
}

/**
 * Law 25 erasure of an account and its sessions. An account that owns a shop is NOT erased from the console: the shop's
 * invoices and tax ledger are kept for six years (tax law), and they belong to the merchant — code RETENTION_REQUIRED.
 * The audit log keeps the fact and the id, and the deleted account's own lines lose their e-mail and address. The
 * operator types the account's e-mail; never their own account, never the last administrator.
 */
export async function deleteAccount(actor: Actor, id: string, confirmEmail: string, headers?: Headers): Promise<{ deleted: true }> {
  const user = await userDetail(id);
  if (id === actor.id) throw refuse(409, "SELF_DELETE", "You cannot delete your own account");
  if (user.shops > 0) throw refuse(409, "RETENTION_REQUIRED", "This account owns a shop whose invoices and tax ledger are kept for six years");
  if (user.role === "ADMIN" && (await activeAdmins()) <= 1) throw refuse(409, "LAST_ADMIN", "The last administrator keeps the role");
  if (confirmEmail.trim().toLowerCase() !== user.email) throw refuse(409, "CONFIRM_MISMATCH", "The e-mail typed does not match the account");
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE audit_log SET actor_label = 'deleted account', ip = NULL WHERE actor_id = $1", [id]);
    await client.query("DELETE FROM accounts WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await audit({ action: "admin.account_deleted", actorId: actor.id, actorLabel: actor.email, targetId: id, headers });
  return { deleted: true };
}

// ── Audit ────────────────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  ip: string | null;
}

export async function auditLog(limit = 300, targetId?: string): Promise<AuditEntry[]> {
  const rows = await query<{ id: string; at: Date; actor_label: string; action: string; target_id: string | null; ip: string | null }>(
    `SELECT id, at, actor_label, action, target_id, ip FROM audit_log ${targetId ? "WHERE target_id = $2 OR actor_id::text = $2" : ""} ORDER BY at DESC LIMIT $1`,
    targetId ? [limit, targetId] : [limit],
  );
  return rows.map((r) => ({ id: String(r.id), at: r.at.toISOString(), actor: r.actor_label, action: r.action, target: r.target_id, ip: r.ip }));
}
