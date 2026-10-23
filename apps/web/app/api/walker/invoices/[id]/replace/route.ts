import { invoiceInputSchema, replaceInvoice } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, idParam, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * « Modifier la facture » (#207): the issued invoice is cancelled by its credit note and replaced by the corrected one,
 * in one transaction — an issued invoice itself never changes. Owner and manager (permission `invoices`).
 */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "invoices");
    const originalId = idParam((await params).id);
    const input = await readJson(req, invoiceInputSchema);
    const { credit, replacement, totals } = await replaceInvoice(db(), shop.id, originalId, input);
    await audit({ action: "invoice.corrected", actorId: session.account.id, actorLabel: session.account.email, targetId: originalId, detail: { credit: credit.number, replacement: replacement.number }, headers: req.headers });
    return Response.json({ id: replacement.id, number: replacement.number, creditNumber: credit.number, totalCents: totals.totalCents }, { status: 201 });
  });
}
