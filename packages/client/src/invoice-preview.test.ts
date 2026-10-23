import { describe, expect, it } from "vitest";

import { previewTotals } from "./invoice-preview";

const walk = { id: "v1", nameFr: "Promenade", nameEn: "Walk", priceCents: 4500, taxCategory: "standard" as const };
const bread = { id: "v2", nameFr: "Pain", nameEn: "Bread", priceCents: 400, taxCategory: "zeroRated" as const };

describe("the total of a quick invoice, before it is issued", () => {
  it("charges GST 5 % and QST 9.975 % once on the taxable base, to the cent", () => {
    const totals = previewTotals([{ serviceId: "v1", quantity: 1 }], [walk], true);
    expect(totals).toMatchObject({ subtotalCents: 4500, gstCents: 225, qstCents: 449, totalCents: 5174 });
  });

  it("leaves a zero-rated line out of the base and a small supplier out of the taxes", () => {
    expect(previewTotals([{ serviceId: "v2", quantity: 3 }], [bread], true)).toMatchObject({ gstCents: 0, qstCents: 0, totalCents: 1200 });
    expect(previewTotals([{ description: "Coupe", quantity: 1, unitPriceCents: 4500 }], [], false)).toMatchObject({ gstCents: 0, qstCents: 0, totalCents: 4500 });
  });

  it("answers nothing for no line, or a service the shop does not have", () => {
    expect(previewTotals([], [walk], true)).toBeNull();
    expect(previewTotals([{ serviceId: "unknown", quantity: 1 }], [walk], true)).toBeNull();
  });
});
