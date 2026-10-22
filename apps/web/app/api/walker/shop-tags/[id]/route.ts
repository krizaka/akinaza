import { z } from "zod";

import { requireSession } from "@/lib/access";
import { handle, idParam, readJson } from "@/lib/http";
import { organize } from "@/lib/organize";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const owner = (await requireSession(req)).account.id;
    const input = await readJson(req, z.object({ name: z.string().optional(), color: z.enum(["blue", "green", "amber", "red", "violet", "gray"]).optional() }));
    return Response.json({ tag: await organize().tags.update(owner, idParam((await params).id), input) });
  });
}

export function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    await organize().tags.remove((await requireSession(req)).account.id, idParam((await params).id));
    return Response.json({ ok: true });
  });
}
