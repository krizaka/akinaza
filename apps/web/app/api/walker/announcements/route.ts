import { addAnnouncement, announcementsOf } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { assertShopFeature } from "@/lib/community";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    return Response.json({ announcements: await announcementsOf(db(), shop.id) });
  });
}

/** Pins a flyer to the bulletin board (500 characters, an optional photo and last day). Owner and manager. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    await assertShopFeature("features.shopAnnouncements");
    const flyer = await readJson(req, z.object({ textFr: z.string().max(500).default(""), textEn: z.string().max(500).default(""), photoUrl: z.string().max(500).nullable().default(null), photoAlt: z.string().max(200).default(""), endsOn: z.string().nullable().default(null) }));
    const id = await addAnnouncement(db(), shop.id, flyer);
    await audit({ action: "shop.announcement_added", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { announcement: id }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json({ id }, { status: 201 });
  });
}
