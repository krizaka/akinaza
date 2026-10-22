import { z } from "zod";

import { accounts } from "@/app/accounts";
import { accountAct } from "@/lib/account-access";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Changes the password (the current one is checked) and signs every other session out. */
export const POST = (req: Request) =>
  accountAct(req, "password", async (s) => {
    const input = await readJson(req, z.object({ current: z.string().max(256), next: z.string().max(256) }));
    await accounts().changePassword(s.account.id, input, s.id);
    await audit({ action: "account.password_changed", actorId: s.account.id, actorLabel: s.account.email, headers: req.headers });
    return { ok: true };
  });
