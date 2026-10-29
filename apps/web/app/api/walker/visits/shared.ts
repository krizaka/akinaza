import type { checkIn } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam } from "@/lib/http";
import { requestNow } from "@/app/request-now";

type VisitCall<R> = (database: ReturnType<typeof db>, shopId: Parameters<typeof checkIn>[1], visitId: Parameters<typeof checkIn>[2], at: Date) => Promise<R>;

/** `check-in` and `check-out` are the same POST - owner, the visit of the path, the moment now - and differ by the call and the answer. */
export function visitRoute<R>(act: VisitCall<R>, answer: (at: Date, result: R) => unknown) {
  return (req: Request, { params }: { params: Promise<{ id: string }> }) =>
    handle(async () => {
      const { shop } = await requireShop(req, "checkin");
      const at = requestNow();
      const result = await act(db(), shop.id, idParam((await params).id), at);
      return Response.json(answer(at, result));
    });
}
