import { invoiceTotals, type TaxCategory } from "@akinaza/core";

import { parseQuantity } from "./quantity";

/** A service a new invoice can bill, with what the live total needs: its price and its tax category. */
export interface BillableService {
  id: string;
  nameFr: string;
  nameEn: string;
  priceCents: number;
  taxCategory: TaxCategory;
}

/** A line as the form holds it: one of the shop's services (its name and price), or a free line with its own description and price. */
export interface InvoiceLineInput {
  serviceId: string;
  description: string;
  quantity: string;
  unitPriceCents: number;
}

export const emptyLine = (): InvoiceLineInput => ({ serviceId: "", description: "", quantity: "1", unitPriceCents: 0 });

/** What the API bills: a chosen service with its quantity, or a free line with its description and price. A line that says nothing is skipped. */
export type ApiLine = { serviceId: string; quantity: number } | { description: string; quantity: number; unitPriceCents: number };

export function billableLines(lines: readonly InvoiceLineInput[]): ApiLine[] {
  return lines.flatMap((line): ApiLine[] => {
    const quantity = parseQuantity(line.quantity);
    if (quantity === null) return [];
    if (line.serviceId) return [{ serviceId: line.serviceId, quantity }];
    const description = line.description.trim();
    return description ? [{ description, quantity, unitPriceCents: line.unitPriceCents }] : [];
  });
}

/**
 * What the invoice will say once issued, before it is: the same rule as the ledger (`invoiceTotals` of @akinaza/core — the
 * GST and the QST once on the taxable subtotal, rounded half away from zero), on the lines the form holds now. A chosen
 * service brings its price and its category; a free line is standard-rated.
 */
export function previewTotals(lines: readonly InvoiceLineInput[], services: readonly BillableService[], registrant: boolean) {
  const priced = lines.flatMap((line) => {
    const quantity = parseQuantity(line.quantity);
    if (quantity === null) return [];
    const service = line.serviceId ? services.find((s) => s.id === line.serviceId) : undefined;
    if (line.serviceId && !service) return [];
    if (!service && !line.description.trim()) return [];
    return [{ description: service?.nameEn ?? line.description, quantity, unitPriceCents: service?.priceCents ?? line.unitPriceCents, category: service?.taxCategory ?? ("standard" as const) }];
  });
  return { ...invoiceTotals(priced, { registrant }), count: priced.length };
}
