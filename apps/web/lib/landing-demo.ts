import type { InvoiceView } from "@/components/app/InvoiceDocument";
import type { Locale } from "@/lib/i18n";

/**
 * The demo data of the home's feature cards (akinaza#470): the real components of the app, drawn with these fictional figures
 * (a dog walker in Saint-Henri, one invoice). Nothing here is a customer's; the cards say « demo ». The taxes are the app's own:
 * GST 5 % and QST 9.975 % of the subtotal, rounded to the cent.
 */
export const DEMO_SUBTOTAL_CENTS = 530_000;
export const DEMO_GST_CENTS = 26_500;
export const DEMO_QST_CENTS = 52_868;

/** One demo invoice, in the language of the page. */
export function demoInvoice(locale: Locale): InvoiceView {
  return {
    id: "demo",
    number: "AK-00012",
    clientId: null,
    replaces: null,
    replacedBy: null,
    creditedBy: null,
    issuedOn: "2026-10-21",
    termsDays: 30,
    dueOn: "2026-11-20",
    language: locale,
    creditOf: null,
    subtotalCents: DEMO_SUBTOTAL_CENTS,
    gstCents: DEMO_GST_CENTS,
    qstCents: DEMO_QST_CENTS,
    totalCents: DEMO_SUBTOTAL_CENTS + DEMO_GST_CENTS + DEMO_QST_CENTS,
    paidCents: 0,
    client: { fullName: "Atelier Lumen (démo)", email: "demo@akinaza.test", phone: null },
    shop: { name: "Pattes Saint-Henri", legalName: "Pattes Saint-Henri (démo)", address: "1 rue Exemple, Montréal QC", timezone: "America/Toronto", registrant: true, gstNumber: "123456789RT0001", qstNumber: "1234567890TQ0001", publicEmail: null },
    lines: [{ id: "l1", invoiceId: "demo", position: 1, description: locale === "fr" ? "Promenades de groupe, octobre" : "Group walks, October", quantityHundredths: 2_000, unitPriceCents: 26_500, discountCents: 0, taxCategory: "standard", amountCents: DEMO_SUBTOTAL_CENTS }],
  };
}

/** The quarter's return lines (FPZ-500) of that same invoice, plus a demo expense: line → cents. */
export const DEMO_RETURN = [
  { line: "101", cents: DEMO_SUBTOTAL_CENTS },
  { line: "103", cents: DEMO_GST_CENTS },
  { line: "106", cents: 4_000 },
  { line: "109", cents: DEMO_GST_CENTS - 4_000 },
  { line: "203", cents: DEMO_QST_CENTS },
  { line: "206", cents: 7_990 },
  { line: "209", cents: DEMO_QST_CENTS - 7_990 },
] as const;

/** A week of free times, as calendar days (no time zone: they are dates). */
export const DEMO_DAYS = [
  { id: "2026-11-03", times: ["09:00", "10:30", "14:00"] },
  { id: "2026-11-04", times: ["09:00", "13:30", "15:00"] },
  { id: "2026-11-05", times: ["10:30", "16:00"] },
] as const;
export const DEMO_PICKED = "2026-11-04T13:30";
