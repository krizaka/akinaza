import { findCodeNames } from "@krizaka/org";
import { describe, expect, it } from "vitest";

import { bindProduct, CODE_NAME, PRODUCT_NAME } from "./brand";
import { getDictionary } from "./i18n";
import { renderMailTemplate } from "./mail-templates";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const BRIEF = { shop: "Salon Laurier", line1: "a", line2: "", has2: false, line3: "", has3: false, url: "https://x.test", stop: "https://x.test/stop" };

describe("the commercial name (krizaka-internal#2039)", () => {
  it("is never the code name", () => {
    expect(PRODUCT_NAME).toBe("Folioviv");
    expect(PRODUCT_NAME.toLowerCase()).not.toBe(CODE_NAME);
  });

  it("fills {product} in a whole tree and leaves the other placeholders", () => {
    expect(bindProduct({ a: ["{product} by {publisher}"], b: 3 }, "Folioviv")).toEqual({ a: ["Folioviv by {publisher}"], b: 3 });
  });

  it("the catalogues carry the placeholder, never a code name; the bound dictionaries carry the commercial name", () => {
    for (const catalogue of [en, fr]) expect(JSON.stringify(catalogue)).not.toMatch(/akinaza(?!\.com)/i);
    for (const locale of ["en", "fr"] as const) {
      const bound = JSON.stringify(getDictionary(locale));
      expect(bound).not.toContain("{product}");
      expect(bound).toContain(PRODUCT_NAME);
    }
  });

  it("a mail wears the name it is given, in the layout and in the body", () => {
    for (const locale of ["en", "fr"]) {
      const mail = renderMailTemplate("brief-weekly", BRIEF, { locale, appUrl: "https://x.test", product: "Folioviv" });
      expect(mail.html).toContain("Folioviv");
      expect(mail.text).toContain("Folioviv");
      expect(findCodeNames(mail.text)).toEqual([]);
      expect(findCodeNames(mail.html.replace(/https?:\/\/\S+/g, ""))).toEqual([]);
    }
  });

  it("a mail without a given name wears the default commercial name", () => {
    expect(renderMailTemplate("brief-weekly", BRIEF, { locale: "en", appUrl: "https://x.test" }).text).toContain(PRODUCT_NAME);
  });
});
