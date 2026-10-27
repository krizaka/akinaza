import { requireShopClient } from "@/lib/access";
import { handle, idParam } from "@/lib/http";

/** What a privacy route of the shop works with: the request, the owner's session and the client file (another shop's is a 404). */
export type ClientPrivacyContext = Awaited<ReturnType<typeof requireShopClient>> & { req: Request };

/** A route on one client file of the shop that only the owner may use (the « privacy » permission: Loi 25 access and erasure). */
export const clientPrivacyRoute = (run: (context: ClientPrivacyContext) => Promise<Response>) => (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => run({ req, ...(await requireShopClient(req, idParam((await params).id), "privacy")) }));
