import { z } from "zod";

import { passwordResets } from "@/app/accounts";
import { systemClock } from "@/app/system-clock";
import { handle, readJson } from "@/lib/http";
import { resetPassword } from "@/lib/password-reset";
import { limit } from "@/lib/rate-limit";

const body = z.object({ token: z.string().max(200), password: z.string().min(1).max(256) });

/** A reset link and the new password. 10 tries per IP per 15 minutes. */
export function POST(req: Request) {
  return handle(async () => {
    const { token, password } = await readJson(req, body);
    limit("password-reset", req, null, [10, 900]);
    await resetPassword(await passwordResets(), token, password, systemClock.now(), req.headers);
    return Response.json({ ok: true });
  });
}
