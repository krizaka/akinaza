import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { format } from "./i18n";
import { publisherVars } from "./publisher";

describe("Loi 25: the privacy officer is published", () => {
  for (const [lang, m] of [["en", en], ["fr", fr]] as const) {
    it(`${lang}: role, contact, company and city, no home address`, () => {
      const o = m.privacy.officer;
      const text = `${o.role} ${format(o.text, publisherVars())}`;
      expect(o.role).toContain("Responsable de la protection des renseignements personnels");
      expect(text).toContain("contact@krizaka.com");
      expect(text).toContain("Technologies Krizaka Inc.");
      expect(text).toContain("Montréal");
      expect(text).not.toMatch(/Sainte-Marguerite|H4C/);
    });
  }
});
