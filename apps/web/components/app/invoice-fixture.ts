import type { InvoiceView } from "./InvoiceDocument";

/** One known invoice (KZ-00004, Studio Lumen inc. (démo), Net 30) for the invoice components' tests. */
export const invoice = (over: Partial<InvoiceView> = {}): InvoiceView => ({
  id: "i1",
  number: "KZ-00004",
  clientId: null,
  replaces: null,
  replacedBy: null,
  creditedBy: null,
  issuedOn: "2026-10-21",
  termsDays: 30,
  dueOn: "2026-11-20",
  language: "fr",
  creditOf: null,
  subtotalCents: 530_000,
  gstCents: 26_500,
  qstCents: 52_868,
  totalCents: 609_368,
  paidCents: 0,
  client: { fullName: "Studio Lumen inc. (démo)", email: "contact.studiolumen@akinaza.test", phone: "514-555-0111" },
  shop: { name: "Technologies Krizaka", legalName: "Technologies Krizaka inc. (démo)", address: "1 rue Exemple, Montréal QC", timezone: "America/Toronto", registrant: true, gstNumber: "123456789RT0001", qstNumber: "1234567890TQ0001", publicEmail: null },
  lines: [{ id: "l1", invoiceId: "i1", position: 1, description: "Développement logiciel / Software development", quantityHundredths: 1_000, unitPriceCents: 15_000, discountCents: 0, taxCategory: "standard", amountCents: 150_000 }],
  ...over,
});
