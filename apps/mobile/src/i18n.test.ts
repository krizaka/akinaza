import en from "./i18n/en.json";
import fr from "./i18n/fr.json";

const leaves = (value: unknown, path = ""): string[] =>
  value && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key)) : [path];

describe("the app's words", () => {
  it("exist in French and in English, with the same keys", () => {
    expect(leaves(fr).sort()).toEqual(leaves(en).sort());
  });
});
