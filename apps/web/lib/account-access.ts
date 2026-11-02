import { enqueueMail, exportClient } from "@akinaza/db";
import { AccountError, postgresAccounts } from "@krizaka/auth";

import { requireSession } from "./access";
import { PRODUCT_NAME } from "./brand";
import { db, query, transaction } from "./db";
import { handle, refuse } from "./http";
import { hashPassword, verifyPassword } from "./password";
import { limit } from "./rate-limit";
import { type Session, tokenHash } from "./session";

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The outbox's name of a mail of the account block: the reset link goes to `/reset-password`, the address change to `/confirm-email`. */
export const accountMailTemplate = (text: string): "password-reset" | "email-change" => (/\/reset-password\?token=/.test(text) ? "password-reset" : "email-change");

/**
 * The account of an Akinaza member (`@krizaka/auth`, the shared block Yomizaka's contract came from): over this app's own
 * PostgreSQL, its password hashing and its session token hash. The mails it sends (an address change, a password reset) are
 * queued in the outbox; they leave when a mail provider is configured. `passwordResetTtlMinutes` comes from the settings
 * (`auth.passwordResetTtlMinutes`), never from here.
 */
export const accountsAt = (baseUrl: string, options: { passwordResetTtlMinutes?: number; product?: string } = {}) =>
  postgresAccounts({
    query: async (sql, params) => query(sql, params) as never,
    transaction: (work) => transaction((run) => work(run as never)),
    mail: async (mail) => {
      await enqueueMail(db(), { to: mail.to, locale: mail.locale, template: accountMailTemplate(mail.text), subject: mail.subject, text: mail.text, html: `<p>${escapeHtml(mail.text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` });
    },
    baseUrl,
    product: options.product ?? PRODUCT_NAME,
    tokenPrefix: "ae",
    passwords: { hash: hashPassword, verify: verifyPassword },
    tokenHash: (token) => tokenHash(token),
    passwordResetTtlMinutes: options.passwordResetTtlMinutes,
  });

/** One account action: signed in, rate-limited (reads far looser than changes), run, answered as JSON (never cached). A refusal of the module is its stable `{ code }` answer. */
export function accountAct(req: Request, scope: string, run: (session: Session) => Promise<Response | Record<string, unknown> | undefined>) {
  return handle(async () => {
    const session = await requireSession(req);
    const reading = req.method === "GET";
    limit(scope, req, session.account.id, reading ? [1200, 3600] : [30, 3600], reading ? [600, 3600] : [15, 3600]);
    try {
      const out = await run(session);
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      if (error instanceof AccountError) throw refuse(error.status, error.code, error.message);
      throw error;
    }
  });
}

/** What Akinaza keeps about a member besides the account: the shops they run and, for each client file of theirs, everything its shop holds (Loi 25, access). */
export async function accountDataWith(accountId: string, key: Buffer): Promise<Record<string, unknown>> {
  const shops = await query<{ id: string; name: string; slug: string | null; published: boolean }>("SELECT id, name, slug, published FROM shops WHERE owner_id = $1 ORDER BY created_at", [accountId]);
  const files = await query<{ id: string }>("SELECT id FROM clients WHERE account_id = $1 AND erased_at IS NULL", [accountId]);
  return { shops, clientFiles: await Promise.all(files.map((f) => exportClient(db(), key, f.id))) };
}
