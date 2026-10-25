import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { invoice } from "./invoice-fixture";
import { InvoiceDocument } from "./InvoiceDocument";

/** The plain text of the markup, one line per block: what a PDF text layer or a screen reader gives. */
const textOf = (html: string) =>
  html
    .replace(/<\/(dt|dd|li|p|h1|h2|div|section|header)>/g, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n");

/** QC-INV-008 of Yomizaka's qc-invoice ruleset (orazaka-packs, document-validation): a payment-terms mention. Kept here as the guard that the document says it. */
const QC_INV_008 = /(?:conditions?\s+de\s+paiement|modalit[ée]s?\s+de\s+paiement|payable\s+(?:dans|sous|au\s+plus|[àa]\s+\d|[àa]\s+r[ée]ception|d[èe]s|le\b)|\bnet\s*\d+|[ée]ch[ée]ance|payment\s+terms|due\s+(?:date|on|upon))/i;

describe("the invoice document says when it is due and under which terms", () => {
  it("French: the terms and the due date, in the language of the invoice", () => {
    const text = textOf(renderToStaticMarkup(<InvoiceDocument invoice={invoice()} locale="en" backHref="/en/app/x/invoices" />));
    expect(text).toMatch(/Conditions de paiement\s*\n\s*Net 30 jours/);
    expect(text).toMatch(/Date d.échéance\s*\n\s*20 novembre 2026/);
    expect(text).toMatch(QC_INV_008);
  });

  it("English: the terms and the due date, whatever the screen's language", () => {
    const text = textOf(renderToStaticMarkup(<InvoiceDocument invoice={invoice({ language: "en" })} locale="fr" backHref="/fr/app/x/invoices" />));
    expect(text).toMatch(/Payment terms\s*\n\s*Net 30 days/);
    expect(text).toMatch(/Due date\s*\n\s*November 20, 2026/);
    expect(text).toMatch(QC_INV_008);
  });

  it("due on receipt reads as such, with the day", () => {
    expect(textOf(renderToStaticMarkup(<InvoiceDocument invoice={invoice({ termsDays: 0, dueOn: "2026-10-21" })} locale="en" backHref="/en/app/x/invoices" />))).toMatch(/Payable à la réception/);
    expect(textOf(renderToStaticMarkup(<InvoiceDocument invoice={invoice({ language: "en", termsDays: 0, dueOn: "2026-10-21" })} locale="en" backHref="/en/app/x/invoices" />))).toMatch(/Due on receipt/);
  });

  it("a fractional quantity reads as a person writes it: 7,5 in French, 7.5 in English (krizaka/akinaza#111)", () => {
    const lines = [{ ...invoice().lines[0]!, quantityHundredths: 750, amountCents: 112_500 }];
    expect(textOf(renderToStaticMarkup(<InvoiceDocument invoice={invoice({ lines })} locale="en" backHref="/en/app/x/invoices" />))).toMatch(/Qté 7,5 × 150,00[\s\u00a0\u202f]\$/);
    expect(textOf(renderToStaticMarkup(<InvoiceDocument invoice={invoice({ language: "en", lines })} locale="fr" backHref="/fr/app/x/invoices" />))).toMatch(/Qty 7\.5 × \$150\.00/);
  });

  it("a credit note and an invoice issued before the terms existed carry none", () => {
    for (const over of [{ termsDays: null, dueOn: null, creditOf: "i0" }, { termsDays: null, dueOn: null }] as const) {
      const text = textOf(renderToStaticMarkup(<InvoiceDocument invoice={invoice(over)} locale="en" backHref="/en/app/x/invoices" />));
      expect(text).not.toMatch(/Conditions de paiement|Date d.échéance|Payment terms|Due date/);
    }
  });
});
