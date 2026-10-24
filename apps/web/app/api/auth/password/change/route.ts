import { AccountError } from "@krizaka/auth";
import { z } from "zod";

import { accounts } from "@/app/accounts";
import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

const body = z.object({ current: z.string().min(1).max(256), password: z.string().min(1).max(256) });

/** The signed-in account changes its password (`@krizaka/auth`: the current one is checked, the other sessions end). 10 tries per IP per 15 minutes. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const { current, password } = await readJson(req, body);
    limit("password-change", req, null, [10, 900]);
    const who = { actorId: session.account.id, actorLabel: session.account.email, targetId: session.account.id, headers: req.headers };
    try {
      await accounts().changePassword(session.account.id, { current, next: password }, session.id);
    } catch (error) {
      if (!(error instanceof AccountError)) throw error;
      if (error.code === "WRONG_PASSWORD") await audit({ action: "auth.password_change_refused", ...who });
      throw refuse(error.status === 403 ? 400 : error.status, error.code, error.message);
    }
    await audit({ action: "auth.password_changed", ...who });
    return Response.json({ ok: true });
  });
}
