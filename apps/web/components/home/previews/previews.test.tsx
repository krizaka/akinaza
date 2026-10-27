import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookPreview } from "./BookPreview";
import { BooksPreview } from "./BooksPreview";
import { InvoicePreview } from "./InvoicePreview";

describe("the home's real previews (akinaza#470)", () => {
  it.each(["en", "fr"] as const)("draws the picker, the invoice and the return in %s, hidden from assistive tech", (locale) => {
    const html = [BookPreview, InvoicePreview, BooksPreview].map((P) => renderToStaticMarkup(<P locale={locale} />));
    for (const h of html) expect(h).toContain('aria-hidden="true"');
    expect(html[0]).toContain("13:30");
    expect(html[1]).toContain("AK-00012");
    expect(html[1]).toMatch(/265[,.]00/);
    expect(html[1]).toMatch(/528[,.]68/);
    expect(html[2]).toContain("FPZ-500");
  });
});
