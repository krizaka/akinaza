import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { format } from "./i18n";
import { publisherVars } from "./publisher";
import { PRIVACY_UPDATED } from "./site";

const LINE = {
  en: "Person in charge of the protection of personal information: the president of Technologies Krizaka Inc. — confidentialite@krizaka.com",
  fr: "Responsable de la protection des renseignements personnels : le président de Technologies Krizaka Inc. — confidentialite@krizaka.com",
} as const;

describe("Loi 25: the person in charge is published by role (the president), at confidentialite@", () => {
  for (const [lang, m] of [["en", en], ["fr", fr]] as const) {
    it(`${lang}: the president, the address, no person's name, no home address, no contact@`, () => {
      const text = format(m.privacy.officer.text, publisherVars());
      expect(text).toContain(LINE[lang]);
      expect(text).toContain("Technologies Krizaka Inc.");
      expect(text).not.toMatch(/Sainte-Marguerite|H4C|Oussama|Abid|contact@krizaka/i);
      expect(JSON.stringify(m.privacy)).not.toMatch(/contact@krizaka/);
    });
  }

  it("the privacy page is dated 2026-11-05", () => {
    expect(PRIVACY_UPDATED).toBe("2026-11-05");
  });
});
