import { z } from "zod";

import { requireSession } from "@/lib/access";
import { handle, readJson } from "@/lib/http";
import { organize } from "@/lib/organize";

export const dynamic = "force-dynamic";
const COLORS = ["blue", "green", "amber", "red", "violet", "gray"] as const;

export function GET(req: Request) {
  return handle(async () => Response.json({ tags: await organize().tags.list((await requireSession(req)).account.id) }));
}

export function POST(req: Request) {
  return handle(async () => {
    const owner = (await requireSession(req)).account.id;
    const input = await readJson(req, z.object({ name: z.string(), color: z.enum(COLORS) }));
    return Response.json({ tag: await organize().tags.create(owner, input) }, { status: 201 });
  });
}
