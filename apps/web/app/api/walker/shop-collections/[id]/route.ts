import { z } from "zod";

import { readJson } from "@/lib/http";
import { onItem } from "@/lib/organize";

export const dynamic = "force-dynamic";

/** Rename, describe, or make it the default collection (`default: true`). */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  onItem(req, params, async (owner, id, o) => {
    const input = await readJson(req, z.object({ name: z.string().optional(), description: z.string().nullable().optional(), default: z.literal(true).optional() }));
    if (input.name !== undefined) await o.profile("collection").rename(owner, id, input.name);
    if (input.description !== undefined) await o.profile("collection").describe(owner, id, input.description);
    if (input.default) await o.collections.setDefault(owner, id);
    return { collection: await o.profile("collection").get(owner, id) };
  });

/** Its shops move to the default collection; the default collection itself is never deleted (409). */
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  onItem(req, params, async (owner, id, o) => {
    await o.collections.remove(owner, id);
    return { ok: true };
  });
