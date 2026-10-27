import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ShopError from "./error";

vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say: (key: string) => key, locale: "en" }) }));

describe("a page of the owner's space that failed", () => {
  it("says it calmly with one action, and never prints the error's own words", () => {
    const html = renderToStaticMarkup(<ShopError error={Object.assign(new Error("ECONNREFUSED 10.0.0.1:5432 relation \"invoices\" does not exist"), { digest: "abc123" })} reset={() => undefined} />);
    expect(html).toContain("states.page.title");
    expect(html).toContain("states.page.body");
    expect(html).toContain("states.retry");
    for (const raw of ["ECONNREFUSED", "relation", "abc123", "Error:"]) expect(html).not.toContain(raw);
  });
});
