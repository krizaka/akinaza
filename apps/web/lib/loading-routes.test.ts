import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** The owner's screens that stream their data: each draws its loading state in the page's own boxes (D6, § 2.5 of the direction). */
const LOADING = ["aujourdhui", "clients", "clients/[id]", "invoices", "invoices/[id]", "books"];
const SHOP_SPACE = fileURLToPath(new URL("../app/[locale]/(app)/app/[shop]/", import.meta.url));

describe("every owner list and file has its loading state (D6)", () => {
  it.each(LOADING)("%s/loading.tsx", (route) => {
    expect(existsSync(`${SHOP_SPACE}${route}/loading.tsx`)).toBe(true);
  });
});
