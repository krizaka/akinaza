import { z } from "zod";

import { hooks } from "@/app/webhooks-edge";
import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, idParam, readJson } from "@/lib/http";
import { webhookRefusal } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Subscribe to other events, pause or resume an endpoint. */
export const PATCH = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    const input = await readJson(req, z.object({ events: z.array(z.string()).max(10).optional(), active: z.boolean().optional() }));
    try {
      return Response.json({ endpoint: await hooks().updateEndpoint(session.account.id, idParam((await params).id), input) });
    } catch (error) {
      throw webhookRefusal(error) ?? error;
    }
  });

export const DELETE = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    const id = idParam((await params).id);
    try {
      await hooks().removeEndpoint(session.account.id, id);
    } catch (error) {
      throw webhookRefusal(error) ?? error;
    }
    await audit({ action: "webhook.deleted", actorId: session.account.id, actorLabel: session.account.email, targetId: id, headers: req.headers });
    return Response.json({ ok: true });
  });
