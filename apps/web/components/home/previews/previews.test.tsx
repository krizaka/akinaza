import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "@/lib/i18n";

import { BookPreview } from "./BookPreview";
import { BooksPreview } from "./BooksPreview";
import { InvoicePreview } from "./InvoicePreview";

const render = (locale: "en" | "fr") => [BookPreview, InvoicePreview, BooksPreview].map((P) => renderToStaticMarkup(<P locale={locale} />));

describe("the home's demo cards: one action and its result (akinaza#470, krizaka-internal#683)", () => {
  it.each(["en", "fr"] as const)("draws the booking, the invoice and the return in %s, hidden from assistive tech", (locale) => {
    const [book, invoice, books] = render(locale);
    for (const h of [book, invoice, books]) expect(h).toContain('aria-hidden="true"');
    expect(book).toContain("13:30");
    // The result is on the card: the total with its two taxes, the three figures of the return.
    expect(invoice).toMatch(/265[,.]00/);
    expect(invoice).toMatch(/528[,.]68/);
    expect(invoice).toMatch(/6[\s\u202f,.]?093[,.]68/);
    expect(books).toMatch(/5[\s\u202f,.]?300[,.]00/);
    expect(books).toMatch(/225[,.]00/);
    expect(books).toMatch(/448[,.]78/);
  });

  it.each(["en", "fr"] as const)("never puts the demo label over the content nor clips the result (%s)", (locale) => {
    const demo = getDictionary(locale).landing.preview.demo;
    for (const h of render(locale)) {
      expect(h).toContain(demo);
      // The label sits in the card's own footer row: nothing is positioned over the content.
      expect(h).not.toMatch(/\babsolute\b/);
      // No fixed height cut by a fade: the result is never hidden.
      expect(h).not.toMatch(/\bh-72\b|mask-image|overflow-hidden|scale-\[/);
    }
  });

  it.each(["en", "fr"] as const)("shows what it does, not a pseudo-document (%s)", (locale) => {
    for (const h of render(locale)) {
      // No registration numbers, no address, no invoice number, no form line codes.
      expect(h).not.toMatch(/RT0001|TQ0001|rue Exemple|AK-000|FPZ-500|>10[1-9]<|>20[1-9]</);
    }
  });
});
