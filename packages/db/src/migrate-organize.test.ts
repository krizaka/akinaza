import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { migrate } from "./migrate";
import { freshEmptyDatabase } from "./test/db";

/** The migrations that make shops items of « organize » must apply to a database that already holds owners and shops (production's case), in one go. */
it("migrates owners and shops that exist already: each owner gets a default collection, each shop falls into it and is the default shop", async () => {
  const full = fileURLToPath(new URL("../drizzle", import.meta.url));
  const before = mkdtempSync(join(tmpdir(), "ak-mig-"));
  try {
    cpSync(full, before, { recursive: true });
    const journal = JSON.parse(readFileSync(join(before, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
    journal.entries = journal.entries.filter((e) => Number(e.tag.slice(0, 4)) < 13);
    writeFileSync(join(before, "meta/_journal.json"), JSON.stringify(journal));
    const old = await freshEmptyDatabase();
    try {
      await migrate(old.pool, before);
      const owner = (await old.pool.query(`INSERT INTO accounts (email, locale, password_hash) VALUES ('old@example.test', 'fr', 'x') RETURNING id`)).rows[0].id as string;
      const shop = (await old.pool.query(`INSERT INTO shops (owner_id, name, legal_name, kind, address, registrant) VALUES ($1, 'S', 'S inc.', 'services', '1 rue Test', false) RETURNING id`, [owner])).rows[0].id as string;
      await migrate(old.pool, full);
      const row = (await old.pool.query(`SELECT s.is_default, c.name, c.is_default AS col_default FROM shops s JOIN collections c ON c.id = s.collection_id WHERE s.id = $1`, [shop])).rows[0];
      expect(row).toEqual({ is_default: true, name: "Mes commerces", col_default: true });
    } finally {
      await old.drop();
    }
  } finally {
    rmSync(before, { recursive: true, force: true });
  }
});
