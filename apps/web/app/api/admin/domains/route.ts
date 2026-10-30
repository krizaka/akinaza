import { requireAdmin } from "@/lib/access";
import { adminDomains } from "@/lib/domains/service";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Every custom domain with its shop and status (pending TXT, pending TLS, active, failed, suspended). */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return Response.json({ domains: await adminDomains() });
  });
}
