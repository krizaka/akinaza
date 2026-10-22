import { z } from "zod";

import { accounts } from "@/app/accounts";
import { systemClock } from "@/app/system-clock";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Applies an e-mail change from the mailed link (single use, 24 h): the new address is verified by that very act. The link is the proof — no session needed. */
export const POST = (req: Request) =>
  handle(async () => {
    limit("confirm-email", req, null, [30, 3600]);
    const { token } = await readJson(req, z.object({ token: z.string().max(200) }));
    const result = await accounts().confirmEmailChange(token, systemClock.now());
    return Response.json({ result }, { status: result === "CHANGED" ? 200 : 400 });
  });
