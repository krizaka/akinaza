import { AccountError, type AccountService } from "@krizaka/auth";

import { audit } from "./audit";
import { query } from "./db";
import { refuse } from "./http";
import { tokenHash } from "./session";

/**
 * A forgotten password, on `@krizaka/auth`: the block issues the link (one use, kept only as its hash, its lifetime from the
 * settings), mails it in the person's language and, from the link, sets the new password and ends every session. This file
 * only adds Akinaza's audit trail and turns the block's refusals into the app's answers.
 */
type Resets = Pick<AccountService, "requestPasswordReset" | "resetPassword">;

const answer = (error: unknown): never => {
  if (error instanceof AccountError) throw refuse(error.status, error.code, error.message);
  throw error;
};

/** Asks for a link: the same answer whether the address has an account or not; the trail names the account when there is one. */
export async function requestPasswordReset(resets: Resets, email: string, now: Date, headers: Headers): Promise<void> {
  await resets.requestPasswordReset(email, now).catch(answer);
  const [row] = await query<{ id: string; email: string }>("SELECT id, email FROM accounts WHERE email = $1 AND password_hash IS NOT NULL", [email.trim().toLowerCase()]);
  if (row) await audit({ action: "auth.password_reset_requested", actorId: row.id, actorLabel: row.email, targetId: row.id, headers });
}

/** Sets the new password from a valid link; a used, expired or unknown link is `INVALID_TOKEN`. */
export async function resetPassword(resets: Resets, token: string, password: string, now: Date, headers: Headers): Promise<void> {
  const result = await resets.resetPassword(token, password, now).catch(answer);
  if (result !== "CHANGED") throw refuse(400, "INVALID_TOKEN", "This link is not valid");
  const [row] = await query<{ id: string; email: string }>("SELECT a.id, a.email FROM password_resets r JOIN accounts a ON a.id = r.account_id WHERE r.token_hash = $1", [tokenHash(token)]);
  if (row) await audit({ action: "auth.password_reset", actorId: row.id, actorLabel: row.email, targetId: row.id, headers });
}
