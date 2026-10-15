import { defineConfig } from "drizzle-kit";

// `pnpm --filter @akinaza/db db:generate` writes the next migration from src/schema.ts into drizzle/. A migration is
// never edited once merged: a change is a new one. The rules the schema cannot say (triggers) are custom migrations.
export default defineConfig({ dialect: "postgresql", schema: "./src/schema.ts", out: "./drizzle" });
