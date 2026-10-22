import { CONSENT_TEXT_VERSION, eraseClient } from "@akinaza/db";
import { z } from "zod";

import { accounts } from "@/app/accounts";
import { accountAct } from "@/lib/account-access";
import { audit } from "@/lib/audit";
import { db, query } from "@/lib/db";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Deletes the account after the password: the person's client files are erased first (Loi 25 — the invoices that name them stay, as
 * the tax law requires), then the account and its sessions go. A shop the person runs outlives the account, unowned: its ledger is
 * kept the legal six years.
 */
export const POST = (req: Request) =>
  accountAct(req, "account-delete", async (s) => {
    const { password } = await readJson(req, z.object({ password: z.string().max(256) }));
    await accounts().confirmPassword(s.account.id, password);
    for (const file of await query<{ id: string }>("SELECT id FROM clients WHERE account_id = $1", [s.account.id])) await eraseClient(db(), file.id, CONSENT_TEXT_VERSION);
    await audit({ action: "account.deleted", actorId: null, actorLabel: s.account.email, targetId: s.account.id, headers: req.headers });
    await accounts().deleteAccount(s.account.id);
    return { ok: true };
  });
