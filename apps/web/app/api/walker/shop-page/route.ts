import { saveShopPageConfig, shopPageConfigOf, shopPageSaveSchema } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { mediaStorage } from "@/lib/media-storage";
import { mediaPrefix } from "@/lib/media-upload";

export const dynamic = "force-dynamic";

/** A file of the brand directory: a name the storage gives (`photo.<sha10>.jpg`) or one published before it (`<sha16>.jpg`). */
const LOGO_FILE = /^(photo\.[a-f0-9]{10}|[a-f0-9]{16})\.(jpg|png|webp)$/;

export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    // Any part of the configuration: what the call does not name stays as it was.
    const config = await readJson(req, shopPageSaveSchema);
    const current = await shopPageConfigOf(db(), shop.id);
    if (config.logoUrl && config.logoUrl !== current.logoUrl) {
      const media = await mediaStorage();
      const logoPrefix = media ? `https://${media.cdn}/${mediaPrefix(shop.id, "brand")}` : null;
      const filename = logoPrefix && config.logoUrl.startsWith(logoPrefix) ? config.logoUrl.slice(logoPrefix.length) : "";
      if (!LOGO_FILE.test(filename)) throw refuse(400, "BAD_REQUEST", "Logo must be uploaded through the storefront media endpoint");
    }
    await saveShopPageConfig(db(), shop.id, config);
    return Response.json(await shopPageConfigOf(db(), shop.id));
  });
}
