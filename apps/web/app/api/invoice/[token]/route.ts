import { invoiceByToken } from "@akinaza/db";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await invoiceByToken(db(), token, new Date());
  if (!invoice) return Response.json({ error: "Invoice link expired or revoked" }, { status: 410, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  return Response.json({ invoice }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
