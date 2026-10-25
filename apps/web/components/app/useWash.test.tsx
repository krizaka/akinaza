import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useWash } from "./useWash";

type Row = { id: string; state: string };
function Rows({ rows }: { rows: Row[] }) {
  const wash = useWash(rows, (r) => r.id, (r) => r.state);
  return createElement("ul", null, ...rows.map((r) => createElement("li", { key: r.id }, createElement("span", wash(r.id), r.state))));
}

describe("useWash (D11)", () => {
  it("marks nothing on the page's arrival (the changed rows of a later read: lib/wash.test.ts)", () => {
    expect(renderToStaticMarkup(createElement(Rows, { rows: [{ id: "a", state: "due" }, { id: "b", state: "paid" }] }))).not.toContain("data-kz-arrive");
  });
});
