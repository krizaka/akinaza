import { describe, expect, it } from "vitest";

import { contactHref } from "./site";

describe("contactHref: the final address (a redirect hop is a Search Console « page with redirect »)", () => {
  it("is localized and carries the topic and source", () => {
    expect(contactHref("fr")).toBe("https://www.krizaka.com/fr/contact?topic=folioviv&source=folioviv-app");
    expect(contactHref("en")).toMatch(/^https:\/\/www\.krizaka\.com\/en\/contact\?topic=folioviv&/);
  });
});
