import { ShopsTable } from "@/components/admin/AdminTables";
import { shopsOverview } from "@/lib/admin-content";

export default async function AdminShops() {
  return <ShopsTable shops={await shopsOverview()} />;
}
