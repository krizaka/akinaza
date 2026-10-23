import { shops } from "@akinaza/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  message: z.string().trim().max(500),
  fromName: z.string().trim().min(1).max(120).regex(/^[^\r\n<>]+$/).nullable(),
  copy: z.boolean(),
  linkDays: z.number().int().min(1).max(365),
});

export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    return Response.json({
      message: shop.invoiceMailMessage,
      fromName: shop.invoiceMailFromName,
      copy: shop.invoiceMailCopy,
      linkDays: shop.invoiceLinkDays,
    });
  });
}

export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const input = await readJson(req, settingsSchema);
    const before = { message: shop.invoiceMailMessage, fromName: shop.invoiceMailFromName, copy: shop.invoiceMailCopy, linkDays: shop.invoiceLinkDays };
    await db().update(shops).set({
      invoiceMailMessage: input.message,
      invoiceMailFromName: input.fromName,
      invoiceMailCopy: input.copy,
      invoiceLinkDays: input.linkDays,
    }).where(and(eq(shops.id, shop.id), eq(shops.ownerId, session.account.id)));
    await audit({ action: "invoice.mail_settings_updated", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { before, after: input }, headers: req.headers });
    return Response.json(input);
  });
}
