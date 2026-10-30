import { describe, expect, it } from "vitest";

import { isOnQuote } from "./service-price";

describe("a service on quote (akinaza#489: Krizaka's Entreprise offer has no list price)", () => {
  it("is a service that varies and lists no price", () => {
    expect(isOnQuote({ priceCents: 0, priceVaries: true })).toBe(true);
  });
  it("is never a free service (no « varies ») nor a priced one", () => {
    expect(isOnQuote({ priceCents: 0, priceVaries: false })).toBe(false);
    expect(isOnQuote({ priceCents: 4500, priceVaries: true })).toBe(false);
    expect(isOnQuote({ priceCents: 4500, priceVaries: false })).toBe(false);
  });
});
