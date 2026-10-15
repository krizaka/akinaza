import { z } from "zod";

import { handle, readJson } from "@/lib/http";
import { requestPasswordReset } from "@/lib/password-reset";
import { limit } from "@/lib/rate-limit";

const body = z.object({ email: z.string().trim().email().max(320) });

/** "Forgot password": always the same 202, whether the address has an account or not. 5 asks per address and 20 per IP per 15 minutes. */
export function POST(req: Request) {
  return handle(async () => {
    const { email } = await readJson(req, body);
    limit("password-forgot", req, email, [20, 900], [5, 900]);
    await requestPasswordReset(email, req.headers);
    return Response.json({ ok: true }, { status: 202 });
  });
}
