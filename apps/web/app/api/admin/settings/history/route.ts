import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Who changed what, when, before and after (`?key=` for one setting). */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const key = new URL(req.url).searchParams.get("key") ?? undefined;
    return Response.json({ history: await appSettings().history({ key }) });
  });
}
