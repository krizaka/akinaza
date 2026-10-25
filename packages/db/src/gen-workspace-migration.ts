import { WORKSPACE, workspaceMigration } from "./workspace";

/** Prints the SQL of migration 0033 (`pnpm --filter @akinaza/db exec tsx src/gen-workspace-migration.ts > drizzle/0033_workspace.sql`). */
export const WORKSPACE_MIGRATION_HEADER =
  "-- « The workspace, organised » (@krizaka/organize 0.4.0, krizaka-ts ADR-003, akinaza#337): the shop's tags and saved views, for clients and invoices, in the `organize` schema.\n-- Generated from `src/workspace.ts` — a test fails when this file and the declaration drift apart. Never edit by hand.\n";
if (process.argv[1]?.endsWith("gen-workspace-migration.ts")) process.stdout.write(WORKSPACE_MIGRATION_HEADER + workspaceMigration(WORKSPACE) + "\n");
