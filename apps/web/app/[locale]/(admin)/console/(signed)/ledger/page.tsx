import { LedgerTable } from "@/components/admin/AdminTables";
import { ledgerChecks } from "@/lib/admin-content";

export default async function AdminLedger() {
  return <LedgerTable checks={await ledgerChecks()} />;
}
