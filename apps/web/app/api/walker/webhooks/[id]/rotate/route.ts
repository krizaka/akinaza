import { hooks } from "@/app/webhooks-edge";
import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, idParam } from "@/lib/http";
import { webhookRefusal } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** A new signing secret (the old one stops at once): in this answer once. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    const id = idParam((await params).id);
    try {
      const { secret } = await hooks().rotateSecret(session.account.id, id);
      await audit({ action: "webhook.secret_rotated", actorId: session.account.id, actorLabel: session.account.email, targetId: id, headers: req.headers });
      return new Response(JSON.stringify({ secret }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
    } catch (error) {
      throw webhookRefusal(error) ?? error;
    }
  });
