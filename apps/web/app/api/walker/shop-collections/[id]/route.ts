import { z } from "zod";

import { requireSession } from "@/lib/access";
import { handle, idParam, readJson } from "@/lib/http";
import { organize } from "@/lib/organize";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Rename, describe, or make it the default collection (`default: true`). */
export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const owner = (await requireSession(req)).account.id;
    const id = idParam((await params).id);
    const input = await readJson(req, z.object({ name: z.string().optional(), description: z.string().nullable().optional(), default: z.literal(true).optional() }));
    const o = organize();
    const c = o.profile("collection");
    if (input.name !== undefined) await c.rename(owner, id, input.name);
    if (input.description !== undefined) await c.describe(owner, id, input.description);
    if (input.default) await o.collections.setDefault(owner, id);
    return Response.json({ collection: await c.get(owner, id) });
  });
}

/** Its shops move to the default collection; the default collection itself is never deleted (409). */
export function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const owner = (await requireSession(req)).account.id;
    await organize().collections.remove(owner, idParam((await params).id));
    return Response.json({ ok: true });
  });
}
