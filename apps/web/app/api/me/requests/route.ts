import { clientRequestInputSchema, clientRequestsOf, saveClientRequest } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The client's requests at one shop (akinaza#210): their own file only. */
export const GET = (req: Request) =>
  handle(async () => {
    const clientId = new URL(req.url).searchParams.get("clientId") ?? "";
    if (!z.uuid().safeParse(clientId).success) throw refuse(400, "BAD_REQUEST", "clientId expected");
    const { client } = await requireOwnClient(req, clientId);
    return Response.json({ requests: await clientRequestsOf(db(), client.id) });
  });

/** Keeps a request: a service, a preferred person, an area, a title and a note. Files come next, one by one. */
export const POST = (req: Request) =>
  handle(async () => {
    const input = await readJson(req, clientRequestInputSchema.extend({ clientId: z.uuid() }));
    const { client } = await requireOwnClient(req, input.clientId);
    return Response.json({ id: await saveClientRequest(db(), client.id, input) }, { status: 201 });
  });
