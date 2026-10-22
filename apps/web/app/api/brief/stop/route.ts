import { unsubscribeBrief } from "@akinaza/db";
import { z } from "zod";

import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Turns the Monday e-mail off from the token of one of its mails — a press on the page, never a mere GET (mail scanners open links). */
export function POST(req: Request) {
  return handle(async () => {
    limit("brief-stop", req, null, [10, 600]);
    const { token } = await readJson(req, z.object({ token: z.string().max(64) }));
    if (!(await unsubscribeBrief(db(), token))) throw refuse(404, "BRIEF_STOP_UNKNOWN", "Unknown link");
    return Response.json({ ok: true });
  });
}
