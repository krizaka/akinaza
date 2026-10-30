import { requireAdmin } from "@/lib/access";
import { removeDomain } from "@/lib/domains/service";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Revokes a domain: it stops being served at once and is released at the edge (audited). `?shopId=` names the shop it belongs to. */
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const shopId = idParam(new URL(req.url).searchParams.get("shopId") ?? "");
    await removeDomain(shopId, idParam((await params).id), { action: "domain.revoke", actorId: session.account.id, actorLabel: session.account.email, headers: req.headers });
    return new Response(null, { status: 204 });
  });
}
