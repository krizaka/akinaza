import { systemClock } from "@/app/system-clock";
import { requireOwner } from "@/lib/access";
import { apiKeys, keyAct, maxActiveKeys } from "@/lib/api-access";
import { audit } from "@/lib/audit";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Replaces a key by a new one (same name, scopes and length of life). The old key keeps working for the grace period; the new key is in this answer only. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    const { id } = await params;
    const keys = apiKeys(systemClock);
    const { key, record } = await keyAct(async () => keys.rotate(session.account.id, id, { maxActive: await maxActiveKeys(session.account.id, systemClock.now()) }));
    await audit({ action: "apikey.rotated", actorId: session.account.id, actorLabel: session.account.email, targetId: record.id, detail: { replaced: id, name: record.name }, headers: req.headers });
    return new Response(JSON.stringify({ key, apiKey: keys.publicView(record) }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  });
