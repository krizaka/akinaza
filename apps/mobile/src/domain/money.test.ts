import { centsOf, dollars } from "./money";

describe("amounts", () => {
  it("writes whole cents in the reader's language", () => {
    expect(dollars(5174, "en").replace(/\s/g, " ")).toBe("$51.74");
    expect(dollars(5174, "fr").replace(/\s/g, " ")).toBe("51,74 $");
  });

  it.each([["45", 4500], ["45,5", 4550], ["45.50", 4550], [" 1 200 ", 120000], ["0,05", 5]])("reads %j as %i cents", (text, cents) => expect(centsOf(text)).toBe(cents));
  it.each(["", "abc", "45,555", "-3", "12345678"])("refuses %j", (text) => expect(centsOf(text)).toBeNull());
});
