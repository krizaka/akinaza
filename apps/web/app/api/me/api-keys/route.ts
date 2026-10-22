import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireOwner } from "@/lib/access";
import { AKINAZA_API_KEY_RULES, apiKeys, assertKeysAllowed, keyAct, maxActiveKeys } from "@/lib/api-access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** The owner's keys: name, the start of the key, scopes, dates, status — never a secret or a hash — and what their plan allows. */
export const GET = (req: Request) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    const keys = apiKeys(systemClock);
    return Response.json({ keys: (await keys.list(session.account.id)).map((k) => keys.publicView(k)), scopes: AKINAZA_API_KEY_RULES.scopes, maxActive: await maxActiveKeys(session.account.id, systemClock.now()), maxExpiryDays: AKINAZA_API_KEY_RULES.maxExpiryDays });
  });

/** Creates a key: the whole key is in this answer and nowhere else, ever. */
export const POST = (req: Request) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    limit("api-keys", req, session.account.id, [30, 3600]);
    const input = await readJson(req, z.object({ name: z.string().max(200), scopes: z.array(z.string()).max(20), expiresInDays: z.number().int().nullable() }));
    const maxActive = await assertKeysAllowed(session.account.id, systemClock.now());
    const keys = apiKeys(systemClock);
    const { key, record } = await keyAct(() => keys.create(session.account.id, input, { maxActive }));
    await audit({ action: "apikey.created", actorId: session.account.id, actorLabel: session.account.email, targetId: record.id, detail: { name: record.name, scopes: record.scopes, expiresAt: record.expiresAt }, headers: req.headers });
    return new Response(JSON.stringify({ key, apiKey: keys.publicView(record) }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  });
