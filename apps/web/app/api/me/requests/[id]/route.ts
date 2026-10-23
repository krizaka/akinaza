import { deleteClientRequest } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { removeStoredFiles } from "@/lib/client-requests";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Deletes a request and its files, on the storage too (Loi 25: the client removes what they gave). */
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const id = z.uuid().parse((await params).id);
    const { clientId } = await readJson(req, z.object({ clientId: z.uuid() }));
    const { client } = await requireOwnClient(req, clientId);
    await removeStoredFiles(await deleteClientRequest(db(), client.id, id));
    return Response.json({ ok: true });
  });
