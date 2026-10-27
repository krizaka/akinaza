import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { DEMO_GST_CENTS, DEMO_QST_CENTS, DEMO_RETURN, DEMO_SUBTOTAL_CENTS, demoInvoice } from "./landing-demo";

describe("the home's demo data (akinaza#470)", () => {
  it("applies GST 5 % and QST 9.975 % to the cent", () => {
    expect(DEMO_GST_CENTS).toBe(Math.round(DEMO_SUBTOTAL_CENTS * 0.05));
    expect(DEMO_QST_CENTS).toBe(Math.round(DEMO_SUBTOTAL_CENTS * 0.09975));
  });

  it("totals the invoice and its line", () => {
    const i = demoInvoice("fr");
    expect(i.language).toBe("fr");
    expect(i.totalCents).toBe(i.subtotalCents + i.gstCents + i.qstCents);
    expect(i.lines[0]!.amountCents).toBe(i.lines[0]!.quantityHundredths * i.lines[0]!.unitPriceCents / 100);
  });

  it("nets each tax in the return as collected minus credits", () => {
    const by = Object.fromEntries(DEMO_RETURN.map((r) => [r.line, r.cents]));
    expect(by["109"]).toBe(by["103"]! - by["106"]!);
    expect(by["209"]).toBe(by["203"]! - by["206"]!);
    expect(by["101"]).toBe(DEMO_SUBTOTAL_CENTS);
  });

  it("says « demo » in both languages", () => {
    expect(en.landing.preview.demo).toBeTruthy();
    expect(fr.landing.preview.demo).toBeTruthy();
  });
});
