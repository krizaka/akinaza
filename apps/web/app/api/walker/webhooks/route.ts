import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { hooks } from "@/app/webhooks-edge";
import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { WEBHOOK_EVENTS, webhookQuota, webhookRefusal } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** The owner's endpoints and the events they may subscribe to. */
export const GET = (req: Request) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    return Response.json({ endpoints: await hooks().listEndpoints(session.account.id), events: WEBHOOK_EVENTS });
  });

/** Registers an endpoint (https, public host): the signing secret is in this answer once. */
export const POST = (req: Request) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    limit("webhooks", req, session.account.id, [30, 3600]);
    const input = await readJson(req, z.object({ url: z.string().max(500), events: z.array(z.string()).max(10) }));
    try {
      const { endpoint, secret } = await hooks().registerEndpoint(session.account.id, input, { maxEndpoints: await webhookQuota(session.account.id) }, systemClock.now());
      await audit({ action: "webhook.created", actorId: session.account.id, actorLabel: session.account.email, targetId: endpoint.id, detail: { url: endpoint.url, events: endpoint.events }, headers: req.headers });
      return new Response(JSON.stringify({ endpoint, secret }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
    } catch (error) {
      throw webhookRefusal(error) ?? error;
    }
  });
