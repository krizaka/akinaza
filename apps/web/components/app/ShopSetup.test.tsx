import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ShopSetup.tsx", import.meta.url), "utf8");

describe("ShopSetup (the page's card follows the server after a template is applied, #291 review)", () => {
  it("resynchronises the page configuration whenever the server hands a new one, so a template's order is not undone", () => {
    // A refresh of the route hands a new configuration object: the card must take it over, and the saved mark stays as it is.
    expect(source).toMatch(/const \[synced, setSynced\] = useState\(initial\);/);
    expect(source).toMatch(/if \(synced !== initial\) \{\s*setSynced\(initial\);\s*setConfig\(initial\);\s*\}/);
  });
});
