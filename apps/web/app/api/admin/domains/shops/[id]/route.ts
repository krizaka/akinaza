import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { setOption } from "@/lib/domains/service";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ enabled: z.boolean() });

/** Enables or disables the paid « own domain » option for a shop (audited; enabling needs a price in force in the catalogue). */
export function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const { enabled } = body.parse(await req.json());
    await setOption(idParam((await params).id), enabled, { actorId: session.account.id, actorLabel: session.account.email, headers: req.headers });
    return new Response(null, { status: 204 });
  });
}
