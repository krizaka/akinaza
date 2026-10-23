import { invoiceDetail } from "@akinaza/db";
import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { mailSettings } from "@/lib/env";
import { handle, idParam, readJson, refuse } from "@/lib/http";
import { sendInvoiceMail } from "@/lib/mail";
import { limit } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  toEmail: z.string().trim().email().max(320),
  message: z.string().trim().max(500).optional(),
});

/** Sends an issued invoice through the outbox and issues a fresh private link for this delivery. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "invoices");
    limit("walker-invoice-send", req, session.account.id, [60, 600]);
    const invoiceId = idParam((await params).id);
    const input = await readJson(req, sendSchema);
    const invoice = await invoiceDetail(db(), shop.id, invoiceId);
    if (!invoice) throw refuse(404, "NOT_FOUND", "Invoice not found");
    if (!invoice.clientId || invoice.creditOf) throw refuse(409, "INVOICE_NOT_SENDABLE", "Only issued client invoices can be sent");
    const maxPerShopPerDay = await appSettings().get("limits.invoiceEmailsPerShopPerDay");
    const result = await sendInvoiceMail(db(), shop.id, invoiceId, input.toEmail, input.message, systemClock.now(), mailSettings(), maxPerShopPerDay);
    await audit({ action: "invoice.sent", actorId: session.account.id, actorLabel: session.account.email, targetId: invoiceId, detail: { deliveryId: result.deliveryId, status: result.status }, headers: req.headers });
    return Response.json(result, { status: 201 });
  });
}
