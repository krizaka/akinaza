import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { checkOwnerDomain, removeDomain, retryOwnerDomain } from "@/lib/domains/service";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ do: z.enum(["check", "retry"]) });

/** `{ "do": "check" | "retry" }`: look at the domain now (rate limited), or start a failed one again. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const id = idParam((await params).id);
    if (body.parse(await req.json()).do === "retry") await retryOwnerDomain(shop.id, id);
    return Response.json({ state: (await checkOwnerDomain(shop.id, id)).state });
  });
}

export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    await removeDomain(shop.id, idParam((await params).id), { action: "domain.remove", actorId: session.account.id, actorLabel: session.account.email, headers: req.headers });
    return new Response(null, { status: 204 });
  });
}
