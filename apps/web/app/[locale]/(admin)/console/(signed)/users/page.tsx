import { UsersTable } from "@/components/admin/AdminTables";
import { listUsers } from "@/lib/admin";

export default async function AdminUsers() {
  return <UsersTable users={await listUsers()} />;
}
