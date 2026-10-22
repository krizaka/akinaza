import { SHOP_AVATAR_SEEDS } from "@akinaza/db";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { handle, idParam, readJson } from "@/lib/http";
import { organize } from "@/lib/organize";

export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  avatar: z.object({ kind: z.literal("set"), seed: z.string() }).nullable().optional(),
  /** The collection the shop is grouped in (`null`: the owner's default collection). */
  collectionId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).max(50).optional(),
});

/** A shop's name, description, avatar (from the set), tags and collection — the package's, for the owner's own shops only (404 otherwise). */
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const owner = session.account.id;
    const id = idParam((await params).id);
    const input = await readJson(req, body);
    const o = organize();
    const shop = o.profile("shop");
    if (input.name !== undefined) await shop.rename(owner, id, input.name);
    if (input.description !== undefined) await shop.describe(owner, id, input.description);
    if (input.avatar !== undefined) await shop.setAvatar(owner, id, input.avatar?.seed ?? null, { allowedSeeds: SHOP_AVATAR_SEEDS });
    if (input.collectionId !== undefined) await shop.setCollection(owner, id, input.collectionId);
    if (input.tagIds !== undefined) await o.tags.assign(owner, "shop", id, input.tagIds);
    return Response.json({ shop: await shop.get(owner, id), tags: (await o.tags.of(owner, "shop", [id])).get(id) ?? [] });
  });
}
