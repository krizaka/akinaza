import { type InvoiceTotals, invoiceTotals, type LineInput, type TaxCategory } from "@akinaza/core";

import { parseQuantity } from "./quantity";

/** One line of « Nouvelle facture » as it is typed: a service of the shop, or free words with their own price. */
export interface DraftLine {
  /** A stable key for the list (add, remove). */
  key: string;
  /** A service of the shop, or "" for a free line. */
  serviceId: string;
  /** A free line's words. */
  description: string;
  /** As typed: `7,5`, `7.5`, `10`. */
  quantity: string;
  /** A free line's unit price, in cents. */
  unitPriceCents: number;
}

export interface DraftService {
  id: string;
  nameFr: string;
  nameEn: string;
  priceCents: number;
  taxCategory: TaxCategory;
}

export const emptyLine = (key: string, serviceId = "", quantity = "1"): DraftLine => ({ key, serviceId, description: "", quantity, unitPriceCents: 0 });

/** A line the server would accept: a service, or words, and a quantity to the hundredth (never zero). */
const complete = (l: DraftLine) => parseQuantity(l.quantity) !== null && (l.serviceId !== "" || l.description.trim() !== "");

/** What « Émettre la facture » sends: a service by its id, a free line by its words and its price (`invoiceInputSchema`). */
export function draftRequestLines(lines: readonly DraftLine[]): Record<string, unknown>[] {
  return lines.filter(complete).map((l) => {
    const quantity = parseQuantity(l.quantity)!;
    return l.serviceId ? { serviceId: l.serviceId, quantity } : { description: l.description.trim(), quantity, unitPriceCents: l.unitPriceCents };
  });
}

/**
 * The total in view: the very computation the server runs at issue (`invoiceTotals` of @akinaza/core — GST 5 % and QST
 * 9,975 % once on the taxable total, half away from zero), on the service's price and tax category. Null without a complete line.
 */
export function draftPreview(lines: readonly DraftLine[], services: readonly DraftService[], shop: { registrant: boolean }): InvoiceTotals | null {
  const inputs: LineInput[] = [];
  for (const l of lines.filter(complete)) {
    const service = l.serviceId ? services.find((s) => s.id === l.serviceId) : undefined;
    if (l.serviceId && !service) continue;
    inputs.push({ description: service ? service.nameFr : l.description.trim(), quantity: parseQuantity(l.quantity)!, unitPriceCents: service ? service.priceCents : l.unitPriceCents, category: service ? service.taxCategory : "standard" });
  }
  return inputs.length ? invoiceTotals(inputs, shop) : null;
}

/**
 * The form's start from its address (`?client=&service=&quantity=`: « Facturer ce client », a finished appointment). A client or
 * a service that is not the shop's is not found — the page answers 404, as for any resource of another shop.
 */
export function prefillDraft(
  query: { client?: string; service?: string; quantity?: string },
  choices: { clients: readonly { id: string }[]; services: readonly { id: string }[] },
): { found: false } | { found: true; clientId: string; lines: DraftLine[] } {
  if (query.client && !choices.clients.some((c) => c.id === query.client)) return { found: false };
  if (query.service && !choices.services.some((s) => s.id === query.service)) return { found: false };
  const quantity = query.quantity && parseQuantity(query.quantity) !== null ? query.quantity : "1";
  return { found: true, clientId: query.client ?? "", lines: [emptyLine("l0", query.service ?? choices.services[0]?.id ?? "", quantity)] };
}
