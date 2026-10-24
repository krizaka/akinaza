import { saveShopPageConfig, shopPageConfigOf, shopPageSaveSchema } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { mediaSettings } from "@/lib/media-upload";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    // Any part of the configuration: what the call does not name stays as it was.
    const config = await readJson(req, shopPageSaveSchema);
    const current = await shopPageConfigOf(db(), shop.id);
    if (config.logoUrl && config.logoUrl !== current.logoUrl) {
      const storage = mediaSettings();
      const logoPrefix = storage ? `https://${storage.cdn}/user/akinaza/shops/${shop.id}/brand/` : null;
      const filename = logoPrefix && config.logoUrl.startsWith(logoPrefix) ? config.logoUrl.slice(logoPrefix.length) : "";
      if (!/^[a-f0-9]{16}\.(jpg|png|webp)$/.test(filename)) throw refuse(400, "BAD_REQUEST", "Logo must be uploaded through the storefront media endpoint");
    }
    await saveShopPageConfig(db(), shop.id, config);
    return Response.json(await shopPageConfigOf(db(), shop.id));
  });
}
