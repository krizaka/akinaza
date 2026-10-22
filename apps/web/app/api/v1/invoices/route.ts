import { listInvoices } from "@akinaza/db";

import { v1 } from "@/lib/api-v1";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The shop's invoices and credit notes, newest first. Scope `invoices:read`. */
export const GET = (req: Request) => v1(req, "invoices:read", async (shop) => ({ invoices: await listInvoices(db(), shop.id) }));
