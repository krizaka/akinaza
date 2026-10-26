import { AVAILABILITY, UNIT } from "@krizaka/settings";
import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { appPrices } from "@/lib/price-catalogue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ key: string }> };

/** A change of an entry: any of its fields, from a date (now when absent, never in the past — the catalogue refuses it). */
const body = z
  .object({
    unit: z.enum(Object.values(UNIT) as [string, ...string[]]).optional(),
    amountCents: z.number().int().min(0).nullable().optional(),
    availability: z.enum(Object.values(AVAILABILITY) as [string, ...string[]]).optional(),
    limits: z.record(z.string(), z.number().int().min(0)).optional(),
    effectiveFrom: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

/** Schedules a new version of an entry (validated by the catalogue, audited with before and after); a subscription already sold keeps its version. */
export function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin(req);
    const { key } = await params;
    const { effectiveFrom, ...change } = await readJson(req, body);
    const now = systemClock.now();
    const actor = { id: admin.account.id, label: admin.account.email };
    const entry = await appPrices().schedule(actor, key, change as never, effectiveFrom ? new Date(effectiveFrom) : now, now);
    await audit({ action: "price.scheduled", actorId: admin.account.id, actorLabel: admin.account.email, detail: { key, versionId: entry.versionId, effectiveFrom: entry.effectiveFrom.toISOString() }, headers: req.headers });
    return Response.json({ entry: { ...entry, effectiveFrom: entry.effectiveFrom.toISOString() } });
  });
}
