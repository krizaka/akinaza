import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { InvoiceView } from "./InvoiceDocument";
import { InvoicePublicDocument } from "./InvoicePublicDocument";

const invoice = {
  id: "10000000-0000-4000-8000-000000000001",
  number: "F-00001",
  issuedOn: "2026-10-23",
  termsDays: 30,
  dueOn: "2026-11-22",
  language: "fr" as const,
  clientId: "20000000-0000-4000-8000-000000000001",
  creditOf: null,
  replaces: null,
  replacedBy: { id: "30000000-0000-4000-8000-000000000001", number: "F-00002" },
  creditedBy: null,
  subtotalCents: 10_000,
  gstCents: 500,
  qstCents: 998,
  totalCents: 11_498,
  paidCents: 5_000,
  client: { fullName: "Camille Tremblay", email: "camille@example.com", phone: null },
  shop: { name: "Salon Laurier", legalName: "Salon Laurier inc.", address: "Montréal", timezone: "America/Toronto", registrant: true, gstNumber: "123456789RT0001", qstNumber: "1234567890TQ0001", publicEmail: "bonjour@example.com" },
  lines: [{ id: "40000000-0000-4000-8000-000000000001", invoiceId: "10000000-0000-4000-8000-000000000001", position: 1, description: "Coupe / Haircut", quantityHundredths: 100, unitPriceCents: 10_000, discountCents: 0, taxCategory: "standard" as const, amountCents: 10_000 }],
} satisfies InvoiceView & { paidCents: number };

const text = (locale: "fr" | "en", replacedBy: InvoiceView["replacedBy"] = invoice.replacedBy) =>
  renderToStaticMarkup(<InvoicePublicDocument invoice={{ ...invoice, replacedBy }} locale={locale} today="2026-10-23" />).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("public invoice document", () => {
  it("renders the invoice, balance, payment contact, and replacement link in French", () => {
    const html = text("fr");
    expect(html).toContain("F-00001");
    expect(html).toContain("Reste à payer");
    expect(html).toContain("F-00002");
    expect(html).toContain("Ouvrir la facture de remplacement dans votre espace");
    expect(html).toContain("bonjour@example.com");
  });

  it("renders the invoice and payment state in English regardless of invoice language", () => {
    const html = text("en", null);
    expect(html).toContain("Still owed");
    expect(html).toContain("Partly paid");
  });
});
