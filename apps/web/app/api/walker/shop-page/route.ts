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
    // Each logo (light, dark) is a file of this shop's own brand directory.
    for (const [next, before] of [[config.logoUrl, current.logoUrl], [config.logoDarkUrl, current.logoDarkUrl]] as const) {
      if (!next || next === before) continue;
      const media = await mediaStorage();
      const logoPrefix = media ? `https://${media.cdn}/${mediaPrefix(shop.id, "brand")}` : null;
      const filename = logoPrefix && next.startsWith(logoPrefix) ? next.slice(logoPrefix.length) : "";
      if (!LOGO_FILE.test(filename)) throw refuse(400, "BAD_REQUEST", "Logo must be uploaded through the storefront media endpoint");
    }
    await saveShopPageConfig(db(), shop.id, config);
    return Response.json(await shopPageConfigOf(db(), shop.id));
  });
}
