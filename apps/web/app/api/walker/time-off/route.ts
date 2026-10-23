import { localDay } from "@akinaza/core";
import { addTimeOff, removeTimeOff, teamTimeOff } from "@akinaza/db";
import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const range = z.object({ staffId: z.uuid(), from: day, to: day });

/** The team's time off from today on, as ranges per person (akinaza#208). Owner and manager: the schedule permission. */
export const GET = (req: Request) =>
  handle(async () => {
    const { shop } = await requireShop(req, "schedule");
    return Response.json({ timeOff: await teamTimeOff(db(), shop.id, localDay(systemClock.now(), shop.timezone)) });
  });

/** Time off for a member of the team, from one day to another (both included), with a private reason. */
export const POST = (req: Request) =>
  handle(async () => {
    const { shop } = await requireShop(req, "schedule");
    const input = await readJson(req, range.extend({ reason: z.string().trim().max(120).optional() }));
    await addTimeOff(db(), shop.id, input.staffId, { from: input.from, to: input.to }, input.reason);
    return Response.json({ ok: true }, { status: 201 });
  });

/** Removes a member's time off over a range. */
export const DELETE = (req: Request) =>
  handle(async () => {
    const { shop } = await requireShop(req, "schedule");
    const input = await readJson(req, range);
    await removeTimeOff(db(), shop.id, input.staffId, { from: input.from, to: input.to });
    return Response.json({ ok: true });
  });
