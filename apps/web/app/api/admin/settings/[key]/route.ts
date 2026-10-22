import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ key: string }> };

/** The scope of a change: global (the default), or one person (`scope: "user"` and their id). */
const body = z.object({ scope: z.enum(["global", "user"]).default("global"), id: z.string().max(64).default(""), value: z.unknown().optional() });

/** Sets a value (validated against the registry; every change is audited with before and after). */
export function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin(req);
    const { key } = await params;
    const input = await readJson(req, body);
    await appSettings().set({ id: admin.account.id, label: admin.account.email }, { scope: input.scope, id: input.scope === "global" ? "" : input.id }, key, input.value, systemClock.now());
    await audit({ action: "setting.changed", actorId: admin.account.id, actorLabel: admin.account.email, detail: { key, scope: input.scope }, headers: req.headers });
    return Response.json({ ok: true });
  });
}

/** Back to the default: the override goes. */
export function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin(req);
    const { key } = await params;
    const input = await readJson(req, body.omit({ value: true }));
    await appSettings().reset({ id: admin.account.id, label: admin.account.email }, { scope: input.scope, id: input.scope === "global" ? "" : input.id }, key, systemClock.now());
    return Response.json({ ok: true });
  });
}
