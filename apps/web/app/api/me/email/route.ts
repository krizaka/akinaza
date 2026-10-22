import { z } from "zod";

import { accounts } from "@/app/accounts";
import { systemClock } from "@/app/system-clock";
import { accountAct } from "@/lib/account-access";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Asks to change the address: the password is checked, a link goes to the NEW address. The answer is the same whether or not it is taken. */
export const POST = (req: Request) =>
  accountAct(req, "email", async (s) => {
    const input = await readJson(req, z.object({ newEmail: z.string().max(320), password: z.string().max(256) }));
    await accounts().requestEmailChange(s.account.id, input, systemClock.now());
    await audit({ action: "account.email_change_requested", actorId: s.account.id, actorLabel: s.account.email, headers: req.headers });
    return { ok: true };
  });
