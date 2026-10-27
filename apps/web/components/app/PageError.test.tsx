import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PageError } from "./PageError";

vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say: (key: string) => key, locale: "en" }) }));

describe("a page of the signed-in space that failed", () => {
  it("says it calmly with one action, and has no place to print the error's own words", () => {
    const html = renderToStaticMarkup(<PageError reset={() => undefined} />);
    expect(html).toContain("states.page.title");
    expect(html).toContain("states.page.body");
    expect(html).toContain("states.retry");
    for (const raw of ["ECONNREFUSED", "relation", "abc123", "Error:"]) expect(html).not.toContain(raw);
  });
});
