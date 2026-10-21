import { invoiceInputSchema, issueShopInvoice } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Issues an invoice from the shop's services and free lines: GST and QST to the cent, the ledger posted in the same transaction. The owner only. */
export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const input = await readJson(req, invoiceInputSchema);
    const { invoice, totals } = await issueShopInvoice(db(), shop.id, input);
    return Response.json({ id: invoice.id, number: invoice.number, subtotalCents: totals.subtotalCents, gstCents: totals.gstCents, qstCents: totals.qstCents, totalCents: totals.totalCents }, { status: 201 });
  });
}
