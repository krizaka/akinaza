import { invoiceMailPlatformSettings } from "@akinaza/db/schema";

import { InvoicesTable } from "@/components/admin/AdminTables";
import { InvoiceMailPlatformSettings } from "@/components/admin/InvoiceMailPlatformSettings";
import { invoicesOverview } from "@/lib/admin-content";
import { db } from "@/lib/db";

export default async function AdminInvoices() {
  const [settings] = await db().select().from(invoiceMailPlatformSettings);
  return (
    <div className="flex flex-col gap-5">
      <InvoicesTable invoices={await invoicesOverview()} />
      <InvoiceMailPlatformSettings initial={{ maxPerShopPerDay: settings?.maxPerShopPerDay ?? 50, allowedSenderDomain: settings?.allowedSenderDomain ?? null }} />
    </div>
  );
}
