import crypto from "node:crypto";

import { audit } from "./audit";
import { query } from "./db";
import { refuse } from "./http";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

/**
 * Account passwords: a reset link (one use, 30 minutes, kept only as its hash) and a change while signed in. A reset or a
 * change ends the other sessions. The e-mail that carries the link is not wired yet (no mail provider is configured);
 * until it is, `requestPasswordReset` still answers the same way whether the address exists or not.
 */
export const RESET_TTL_MINUTES = 30;
const RESET_TOKEN = /^ar1\.[A-Za-z0-9_-]{43}$/;

export const newResetToken = () => `ar1.${crypto.randomBytes(32).toString("base64url")}`;
export const isResetToken = (value: unknown): value is string => typeof value === "string" && RESET_TOKEN.test(value);
/** The table keeps the hash of a 256-bit random token: a plain SHA-256 is enough, no secret needed. */
export const resetTokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Creates a reset link for an active account with a password. Returns the link's token, or null (nothing happens). */
export async function requestPasswordReset(email: string, headers: Headers): Promise<{ accountId: string; token: string } | null> {
  const [row] = await query<{ id: string; email: string }>(
    "SELECT id, email FROM accounts WHERE email = $1 AND status = 'ACTIVE' AND password_hash IS NOT NULL",
    [email.trim().toLowerCase()],
  );
  if (!row) return null;
  const token = newResetToken();
  await query(
    `INSERT INTO password_resets (account_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [row.id, resetTokenHash(token), RESET_TTL_MINUTES],
  );
  await audit({ action: "auth.password_reset_requested", actorId: row.id, actorLabel: row.email, targetId: row.id, headers });
  return { accountId: row.id, token };
}

/** Sets the new password from a valid link: the link is used up, every session of the account ends. */
export async function resetPassword(token: string, password: string, headers: Headers): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw refuse(400, problem === "TOO_SHORT" ? "PASSWORD_TOO_SHORT" : "PASSWORD_TOO_LONG", "The password does not meet the rules");
  if (!isResetToken(token)) throw refuse(400, "INVALID_TOKEN", "This link is not valid");
  const hash = await hashPassword(password);
  const [row] = await query<{ id: string; email: string }>(
    `WITH claimed AS (
       UPDATE password_resets SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING account_id)
     UPDATE accounts SET password_hash = $2
      WHERE id IN (SELECT account_id FROM claimed) AND status = 'ACTIVE'
      RETURNING id, email`,
    [resetTokenHash(token), hash],
  );
  if (!row) throw refuse(400, "INVALID_TOKEN", "This link is not valid");
  await query("DELETE FROM sessions WHERE account_id = $1", [row.id]);
  await audit({ action: "auth.password_reset", actorId: row.id, actorLabel: row.email, targetId: row.id, headers });
}

/** A change while signed in: the current password is asked again; the other sessions end, this one stays. */
export async function changePassword(session: { accountId: string; sessionId: string; email: string }, current: string, password: string, headers: Headers): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw refuse(400, problem === "TOO_SHORT" ? "PASSWORD_TOO_SHORT" : "PASSWORD_TOO_LONG", "The password does not meet the rules");
  const [row] = await query<{ password_hash: string | null }>("SELECT password_hash FROM accounts WHERE id = $1", [session.accountId]);
  if (!row?.password_hash || !(await verifyPassword(current, row.password_hash))) {
    await audit({ action: "auth.password_change_refused", actorId: session.accountId, actorLabel: session.email, targetId: session.accountId, headers });
    throw refuse(400, "WRONG_PASSWORD", "The current password is not right");
  }
  await query("UPDATE accounts SET password_hash = $2 WHERE id = $1", [session.accountId, await hashPassword(password)]);
  await query("DELETE FROM sessions WHERE account_id = $1 AND id <> $2", [session.accountId, session.sessionId]);
  await audit({ action: "auth.password_changed", actorId: session.accountId, actorLabel: session.email, targetId: session.accountId, headers });
}
