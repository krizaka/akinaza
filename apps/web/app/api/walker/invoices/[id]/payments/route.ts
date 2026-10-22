import { paymentInputSchema, recordPayment } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";
import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, idParam, readJson } from "@/lib/http";
import { emitWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Records a payment received against an invoice (cash, card, transfer, other): never more than what is due, none on a credit note. The one that completes the invoice tells `invoice.paid`. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const invoiceId = idParam((await params).id);
    const input = await readJson(req, paymentInputSchema);
    const result = await recordPayment(db(), shop.id, invoiceId, input, systemClock.now());
    await audit({ action: "invoice.payment_recorded", actorId: session.account.id, actorLabel: session.account.email, targetId: invoiceId, detail: { method: input.method, amountCents: input.amountCents, paid: result.paid }, headers: req.headers });
    if (result.becamePaid) await emitWebhook(session.account.id, { id: `invoice-paid:${invoiceId}`, type: "invoice.paid", payload: { invoiceId, shopId: shop.id, totalCents: result.totalCents } }, systemClock.now());
    return Response.json(result, { status: 201 });
  });
}
