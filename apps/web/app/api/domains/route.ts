import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { addOwnerDomain, ownerDomains } from "@/lib/domains/service";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The owner's domains: the option's state, the records to add and the live status of each (Boutique › Address). */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    return Response.json(await ownerDomains(shop.id, shop.customDomainEnabled));
  });
}

const body = z.object({ hostname: z.string().min(1).max(300) });

/** Adds a domain (the option must be on; the limit is the catalogue's). */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const { hostname } = body.parse(await req.json());
    const row = await addOwnerDomain(shop.id, hostname, { actorId: session.account.id, actorLabel: session.account.email, headers: req.headers });
    return Response.json({ id: row.id, hostname: row.hostname }, { status: 201 });
  });
}
