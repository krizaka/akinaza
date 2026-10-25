import { isWorkspaceKind } from "@akinaza/db";
import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { handle, readJson, refuse } from "@/lib/http";
import { actorOf, workspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** The kind of the address, or 404. */
const kindOf = async (params: Promise<{ kind: string }>) => {
  const { kind } = await params;
  if (!isWorkspaceKind(kind)) throw refuse(404, "NOT_FOUND", "Not found");
  return kind;
};

/**
 * The administrator's configuration of a kind (akinaza#337): the roles that write tags, the max, the default tag set per trade
 * and language, the status set and the system views. The database is the source of truth; code only seeded it.
 */
export function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  return handle(async () => {
    await requireAdmin(req);
    const kind = await kindOf(params);
    return Response.json({ stored: await workspace("platform").config.get(kind) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

/** Saves a configuration at the version the editor read (409 CONFLICT when stale, 409 STATE_IN_USE when it drops a state in use); audited. */
export function PUT(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  return handle(async () => {
    const { account } = await requireAdmin(req);
    const kind = await kindOf(params);
    const body = await readJson(req, z.object({ config: z.record(z.string(), z.unknown()), version: z.number().int().nullable() }));
    if (body.config.kind !== kind) throw refuse(400, "BAD_REQUEST", "The configuration is for another kind");
    return Response.json({ stored: await workspace("platform").config.put(actorOf(account, "admin"), body.config, body.version) });
  });
}
