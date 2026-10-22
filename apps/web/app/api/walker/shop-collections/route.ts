import { z } from "zod";

import { requireSession } from "@/lib/access";
import { handle, readJson } from "@/lib/http";
import { organize } from "@/lib/organize";

export const dynamic = "force-dynamic";

/** The owner's collections of shops (the default one is always there). */
export function GET(req: Request) {
  return handle(async () => Response.json({ collections: await organize().collections.list((await requireSession(req)).account.id) }));
}

export function POST(req: Request) {
  return handle(async () => {
    const owner = (await requireSession(req)).account.id;
    const input = await readJson(req, z.object({ name: z.string(), description: z.string().nullable().optional() }));
    return Response.json({ collection: await organize().collections.create(owner, input) }, { status: 201 });
  });
}
