import { dependantInputSchema } from "@akinaza/core";
import { addDependant } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = dependantInputSchema.extend({ clientId: z.string().uuid() });

/** The client adds a dog (or another dependant) to their file. */
export function POST(req: Request) {
  return handle(async () => {
    const { clientId, ...input } = await readJson(req, body);
    const { client } = await requireOwnClient(req, clientId);
    return Response.json({ id: await addDependant(db(), client.id, input) }, { status: 201 });
  });
}
