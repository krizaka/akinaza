import { hooks } from "@/app/webhooks-edge";
import { requireOwner } from "@/lib/access";
import { handle, idParam } from "@/lib/http";
import { webhookRefusal } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** What was sent to the endpoint and how it went (the last 50). */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    try {
      return Response.json({ deliveries: await hooks().deliveries(session.account.id, idParam((await params).id)) });
    } catch (error) {
      throw webhookRefusal(error) ?? error;
    }
  });
