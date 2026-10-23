import { removeClientRequestFile } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { removeStoredFiles } from "@/lib/client-requests";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Removes one file of a request, from the storage too. */
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) =>
  handle(async () => {
    const { id, fileId } = await params;
    const { clientId } = await readJson(req, z.object({ clientId: z.uuid() }));
    const { client } = await requireOwnClient(req, clientId);
    const url = await removeClientRequestFile(db(), client.id, z.uuid().parse(id), z.uuid().parse(fileId));
    if (url) await removeStoredFiles([url]);
    return Response.json({ ok: true });
  });
