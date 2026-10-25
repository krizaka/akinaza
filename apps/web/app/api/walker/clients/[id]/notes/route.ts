import { addClientNote } from "@akinaza/db";
import { z } from "zod";

import { accounts } from "@/app/accounts";
import { requireShopClient } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

const noteSchema = z.object({ body: z.string().max(2000) });

/**
 * Adds a signed, dated note to one of the shop's client files (D5): the author is the session's account, under the name it shows
 * (else its e-mail). Another shop's client is a 404 (`requireShopClient`), like an unknown one.
 */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, shop, client } = await requireShopClient(req, idParam((await params).id), "clients");
    const { body } = noteSchema.parse(await req.json());
    const profile = await accounts().profile(session.account.id);
    const note = await addClientNote(db(), shop.id, client.id, { accountId: session.account.id, name: profile.name ?? session.account.email }, body, new Date());
    return Response.json({ note }, { status: 201 });
  });
}
