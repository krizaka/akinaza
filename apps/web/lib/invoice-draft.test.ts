import { describe, expect, it } from "vitest";

import { draftPreview, draftRequestLines, emptyLine, prefillDraft } from "./invoice-draft";

const services = [
  { id: "s-hour", nameFr: "Développement (à l'heure)", nameEn: "Development (hourly)", priceCents: 15_000, taxCategory: "standard" as const },
  { id: "s-book", nameFr: "Livre", nameEn: "Book", priceCents: 2_000, taxCategory: "zeroRated" as const },
];
const clients = [{ id: "c-1", fullName: "Studio Lumen inc. (démo)", language: "fr" as const }];
const line = (over: Partial<ReturnType<typeof emptyLine>>) => ({ ...emptyLine("k"), ...over });

describe("Nouvelle facture: the preview is the server's own computation (@akinaza/core invoiceTotals)", () => {
  it("10 h at 150 $ + a 1 500 $ licence + a 500 $ pack: GST 175,00 $, QST 349,13 $ (349,125 rounds up), once on the taxable total", () => {
    const totals = draftPreview(
      [line({ serviceId: "s-hour", quantity: "10" }), line({ description: "Licence", quantity: "1", unitPriceCents: 150_000 }), line({ description: "Support (forfait)", quantity: "1", unitPriceCents: 50_000 })],
      services,
      { registrant: true },
    )!;
    expect(totals).toMatchObject({ subtotalCents: 350_000, gstCents: 17_500, qstCents: 34_913, totalCents: 402_413 });
  });

  it("reads a quantity to the hundredth with a comma or a point, and leaves a zero-rated service out of the taxes", () => {
    const comma = draftPreview([line({ serviceId: "s-hour", quantity: "7,5" })], services, { registrant: true })!;
    const point = draftPreview([line({ serviceId: "s-hour", quantity: "7.5" })], services, { registrant: true })!;
    expect(comma.subtotalCents).toBe(112_500);
    expect(point).toEqual(comma);
    expect(draftPreview([line({ serviceId: "s-book", quantity: "2" })], services, { registrant: true })).toMatchObject({ subtotalCents: 4_000, gstCents: 0, qstCents: 0, totalCents: 4_000 });
  });

  it("charges no tax for a small supplier, and has no total without a complete line", () => {
    expect(draftPreview([line({ serviceId: "s-hour", quantity: "1" })], services, { registrant: false })).toMatchObject({ gstCents: 0, qstCents: 0, totalCents: 15_000 });
    expect(draftPreview([line({ quantity: "1" }), line({ serviceId: "s-hour", quantity: "0" }), line({ serviceId: "s-hour", quantity: "1,234" })], services, { registrant: true })).toBeNull();
  });

  it("sends the lines as the server reads them: a service by its id, a free line by its words and price", () => {
    expect(draftRequestLines([line({ serviceId: "s-hour", quantity: "7,5" }), line({ description: " Licence ", quantity: "1", unitPriceCents: 150_000 }), line({ quantity: "2" })])).toEqual([
      { serviceId: "s-hour", quantity: 7.5 },
      { description: "Licence", quantity: 1, unitPriceCents: 150_000 },
    ]);
  });
});

describe("the prefill (« Facturer ce client », a finished appointment): ?client=&service=&quantity=", () => {
  it("opens with the client and the line chosen", () => {
    expect(prefillDraft({ client: "c-1", service: "s-hour", quantity: "1.5" }, { clients, services })).toMatchObject({ found: true, clientId: "c-1", lines: [{ serviceId: "s-hour", quantity: "1.5" }] });
    // Without a service asked, the line starts on the shop's first service (its price is in view at once).
    expect(prefillDraft({}, { clients, services })).toMatchObject({ found: true, clientId: "", lines: [{ serviceId: "s-hour", quantity: "1" }] });
    expect(prefillDraft({}, { clients, services: [] })).toMatchObject({ found: true, lines: [{ serviceId: "", quantity: "1" }] });
  });

  it("does not know a client or a service that is not the shop's: the page answers 404", () => {
    expect(prefillDraft({ client: "c-other-shop" }, { clients, services })).toEqual({ found: false });
    expect(prefillDraft({ client: "c-1", service: "s-other-shop" }, { clients, services })).toEqual({ found: false });
  });
});
