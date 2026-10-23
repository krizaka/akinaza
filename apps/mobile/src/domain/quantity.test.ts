import { parseQuantity } from "./quantity";

describe("a line's quantity", () => {
  it("takes what the server takes, a French comma included", () => {
    expect(parseQuantity("1")).toBe(1);
    expect(parseQuantity("2,5")).toBe(2.5);
    expect(parseQuantity(" 0.01 ")).toBe(0.01);
    expect(parseQuantity("10000")).toBe(10_000);
  });

  it("refuses what would break the totals or be refused by the server", () => {
    for (const bad of ["0", "-1", "0.001", "1.005", "10000.01", "abc", "", "Infinity"]) expect(parseQuantity(bad)).toBeNull();
  });
});
