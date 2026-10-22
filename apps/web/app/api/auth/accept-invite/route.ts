import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { team, teamAct } from "@/lib/team";

export const dynamic = "force-dynamic";

/** The signed-in account takes an invitation sent to its address: the link works once and expires; it never demotes a role already held. */
export const POST = (req: Request) =>
  handle(async () => {
    const session = await requireSession(req);
    limit("accept-invite", req, session.account.id, [20, 3600]);
    const { token } = await readJson(req, z.object({ token: z.string().max(200) }));
    const joined = await teamAct(() => team().acceptInvitation(token, { id: session.account.id, email: session.account.email }, systemClock.now()));
    await audit({ action: "team.joined", actorId: session.account.id, actorLabel: session.account.email, targetId: joined.scopeId, detail: { role: joined.role }, headers: req.headers });
    return Response.json(joined);
  });
