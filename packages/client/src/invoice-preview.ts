import { type Cents, invoiceTotals, type InvoiceTotals, type LineInput } from "@akinaza/core";

import type { InvoiceLine } from "./api";

export interface ShopServiceRef {
  id: string;
  nameFr: string;
  nameEn: string;
  priceCents: number;
  taxCategory: "standard" | "zeroRated" | "exempt";
}

/**
 * What an invoice will total, before it is issued: the same tax code as the server (`@akinaza/core`, GST and QST computed once on the
 * taxable base, to the cent). The server decides; this is what the owner sees while typing.
 */
export function previewTotals(lines: readonly InvoiceLine[], services: readonly ShopServiceRef[], registrant: boolean): InvoiceTotals | null {
  const priced: LineInput[] = [];
  for (const line of lines) {
    if ("serviceId" in line) {
      const service = services.find((s) => s.id === line.serviceId);
      if (!service) return null;
      priced.push({ description: service.nameFr, quantity: line.quantity, unitPriceCents: service.priceCents as Cents, category: service.taxCategory });
    } else {
      priced.push({ description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents as Cents, category: line.category ?? "standard" });
    }
  }
  return priced.length ? invoiceTotals(priced, { registrant }) : null;
}
