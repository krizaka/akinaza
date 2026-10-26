import { removeReel } from "@akinaza/db";

import { db } from "@/lib/db";
import { takeDown } from "@/lib/shop-item-route";

export const dynamic = "force-dynamic";

/** Takes a video down. */
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) => takeDown(req, params, (shopId, id) => removeReel(db(), shopId, id));
