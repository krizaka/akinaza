import { z } from "zod";

import { requireSession } from "@/lib/access";
import { handle, readJson } from "@/lib/http";
import { changePassword } from "@/lib/password-reset";
import { limit } from "@/lib/rate-limit";

const body = z.object({ current: z.string().min(1).max(256), password: z.string().min(1).max(256) });

/** The signed-in account changes its password. 10 tries per IP per 15 minutes. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const { current, password } = await readJson(req, body);
    limit("password-change", req, null, [10, 900]);
    await changePassword({ accountId: session.account.id, sessionId: session.id, email: session.account.email }, current, password, req.headers);
    return Response.json({ ok: true });
  });
}
