import { organizeMigration } from "@krizaka/organize";

import { ORGANIZE_SCHEMA } from "./organize";

/** Prints the SQL of migration 0014 (`pnpm --filter @akinaza/db exec tsx src/gen-organize-migration.ts > drizzle/0014_organize_shops.sql`). */
export const ORGANIZE_MIGRATION_HEADER = "-- Shops are items of « organize » (@krizaka/organize, ADR-006): collections, tags, and a description, an avatar and a collection on every shop.\n-- Generated from `src/organize.ts` — a test fails when this file and the declaration drift apart. Never edit by hand.\n";
if (process.argv[1]?.endsWith("gen-organize-migration.ts")) process.stdout.write(ORGANIZE_MIGRATION_HEADER + organizeMigration(ORGANIZE_SCHEMA) + "\n");
