import { InvoicesTable } from "@/components/admin/AdminTables";
import { invoicesOverview } from "@/lib/admin-content";

export default async function AdminInvoices() {
  return <InvoicesTable invoices={await invoicesOverview()} />;
}
