import { invoiceTotals } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { billableLines, type BillableService, emptyLine, previewTotals } from "./invoice-lines";

const services: BillableService[] = [
  { id: "cut", nameFr: "Coupe", nameEn: "Haircut", priceCents: 4_500, taxCategory: "standard" },
  { id: "book", nameFr: "Livre", nameEn: "Book", priceCents: 2_000, taxCategory: "zeroRated" },
];

describe("the lines of a new invoice (docs/ux/2026-10-full-review.md D5)", () => {
  it("bills a chosen service with its quantity, a free line with its description and price, and skips a line that says nothing", () => {
    expect(
      billableLines([
        { ...emptyLine(), serviceId: "cut", quantity: "2" },
        { ...emptyLine(), description: " Déplacement ", quantity: "1,5", unitPriceCents: 1_000 },
        emptyLine(),
        { ...emptyLine(), serviceId: "cut", quantity: "0" },
      ]),
    ).toEqual([
      { serviceId: "cut", quantity: 2 },
      { description: "Déplacement", quantity: 1.5, unitPriceCents: 1_000 },
    ]);
  });

  it("shows, before issuing, what the ledger will record: the same rule on the same lines", () => {
    const lines = [
      { ...emptyLine(), serviceId: "cut", quantity: "2" },
      { ...emptyLine(), serviceId: "book", quantity: "1" },
      { ...emptyLine(), description: "Déplacement", quantity: "1", unitPriceCents: 1_000 },
    ];
    const expected = invoiceTotals(
      [
        { description: "Haircut", quantity: 2, unitPriceCents: 4_500, category: "standard" },
        { description: "Book", quantity: 1, unitPriceCents: 2_000, category: "zeroRated" },
        { description: "Déplacement", quantity: 1, unitPriceCents: 1_000, category: "standard" },
      ],
      { registrant: true },
    );
    const preview = previewTotals(lines, services, true);
    expect(preview).toMatchObject(expected);
    expect(preview.count).toBe(3);
    expect(preview.subtotalCents).toBe(12_000);
    expect(preview.gstCents).toBe(500);
    expect(preview.qstCents).toBe(998);
    expect(preview.totalCents).toBe(13_498);
  });

  it("charges no tax for a small supplier and counts no line it cannot price", () => {
    const preview = previewTotals([{ ...emptyLine(), serviceId: "cut", quantity: "1" }, { ...emptyLine(), serviceId: "gone", quantity: "1" }, emptyLine()], services, false);
    expect(preview.count).toBe(1);
    expect(preview.gstCents).toBe(0);
    expect(preview.qstCents).toBe(0);
    expect(preview.totalCents).toBe(4_500);
  });
});
