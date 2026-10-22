import { shopClients } from "@akinaza/db";

import { v1 } from "@/lib/api-v1";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The shop's client files with their dependants (never the access notes). Scope `clients:read`. */
export const GET = (req: Request) => v1(req, "clients:read", async (shop) => ({ clients: (await shopClients(db(), shop.id)).map((c) => ({ id: c.id, fullName: c.fullName, phone: c.phone, email: c.email, dependants: c.dependants })) }));
