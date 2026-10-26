import { requireShop } from "@/lib/access";
import { handle, idParam, refuse } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

/**
 * « Take this down » for what is pinned on a shop's page (a video, a flyer): the owner or the manager of the shop, whose own item it is -
 * another shop's id is a 404, the answer of an id that exists nowhere - then the open pages draw themselves again.
 */
export function takeDown(req: Request, params: Promise<{ id: string }>, remove: (shopId: string, id: string) => Promise<boolean>): Promise<Response> {
  return handle(async () => {
    const { shop } = await requireShop(req, "catalogue");
    if (!(await remove(shop.id, idParam((await params).id)))) throw refuse(404, "NOT_FOUND", "Not found");
    await announcePage(shop.id);
    return Response.json({ ok: true });
  });
}
