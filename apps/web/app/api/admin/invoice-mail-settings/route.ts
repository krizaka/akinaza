import { invoiceMailPlatformSettings } from "@akinaza/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const platformSchema = z.object({
  maxPerShopPerDay: z.number().int().min(1).max(10_000),
  allowedSenderDomain: z.string().trim().max(253).regex(/^[a-zA-Z0-9.-]+$/).nullable(),
});

export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const [settings] = await db().select().from(invoiceMailPlatformSettings).where(eq(invoiceMailPlatformSettings.id, "global"));
    return Response.json(settings ?? { maxPerShopPerDay: 50, allowedSenderDomain: null });
  });
}

export function PUT(req: Request) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const input = await readJson(req, platformSchema);
    const [before] = await db().select().from(invoiceMailPlatformSettings).where(eq(invoiceMailPlatformSettings.id, "global"));
    await db().insert(invoiceMailPlatformSettings).values({ id: "global", ...input, updatedAt: new Date() }).onConflictDoUpdate({
      target: invoiceMailPlatformSettings.id,
      set: { ...input, updatedAt: new Date() },
    });
    await audit({ action: "invoice.mail_platform_settings_updated", actorId: session.account.id, actorLabel: session.account.email, targetId: "global", detail: { before: before ?? { maxPerShopPerDay: 50, allowedSenderDomain: null }, after: input }, headers: req.headers });
    return Response.json(input);
  });
}
