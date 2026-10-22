import { describeSettings } from "@krizaka/settings";

import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { appSettings, settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** What can be configured (for the admin screen to draw), each setting's global value and where it comes from, and what is overridden at the global level. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const service = appSettings();
    return Response.json({ settings: describeSettings(settings), values: await service.snapshot(), overrides: await service.overrides({ scope: "global", id: "" }) });
  });
}
