import { describe, expect, it } from "vitest";

import { formatQuantity, parseQuantity, QUANTITY_FIELD } from "./quantity";

describe("a quantity typed on the invoice form (krizaka/akinaza#111)", () => {
  it("reads whole numbers and decimals with a point or a comma, to the hundredth", () => {
    expect(parseQuantity("10")).toBe(10);
    expect(parseQuantity("7.5")).toBe(7.5);
    expect(parseQuantity("7,5")).toBe(7.5);
    expect(parseQuantity(" 0,25 ")).toBe(0.25);
    expect(parseQuantity("1,10")).toBe(1.1);
  });

  it("reads nothing, zero, a thousandth or a stray character as no quantity", () => {
    for (const bad of ["", "0", "0,00", "0,001", "7,555", "-1", "1e3", "7,5 h", "abc", "1 000"]) expect(parseQuantity(bad), bad).toBeNull();
  });

  it("the field accepts what is being typed on the way to a quantity", () => {
    for (const typing of ["", "7", "7,", "7.", "7,5", "7.25", "10000"]) expect(QUANTITY_FIELD.safeParse(typing).success, typing).toBe(true);
    for (const bad of ["7,555", "-1", "a", "1,2,3"]) expect(QUANTITY_FIELD.safeParse(bad).success, bad).toBe(false);
  });

  it("shows a quantity in the reader's language: 7,5 in French, 7.5 in English, never a trailing zero", () => {
    expect(formatQuantity(7.5, "fr")).toBe("7,5");
    expect(formatQuantity(7.5, "en")).toBe("7.5");
    expect(formatQuantity(10, "fr")).toBe("10");
    expect(formatQuantity(0.25, "fr")).toBe("0,25");
    expect(formatQuantity(1_500, "en")).toBe("1,500");
  });
});
