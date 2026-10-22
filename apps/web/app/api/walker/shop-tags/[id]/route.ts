import { z } from "zod";

import { readJson } from "@/lib/http";
import { onItem } from "@/lib/organize";

export const dynamic = "force-dynamic";

export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  onItem(req, params, async (owner, id, o) => ({ tag: await o.tags.update(owner, id, await readJson(req, z.object({ name: z.string().optional(), color: z.enum(["blue", "green", "amber", "red", "violet", "gray"]).optional() }))) }));

export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  onItem(req, params, async (owner, id, o) => {
    await o.tags.remove(owner, id);
    return { ok: true };
  });
