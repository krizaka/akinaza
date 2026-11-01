import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fill, MAIL_LOCALES, MAIL_TEMPLATES, type MailTemplateId, placeholdersOf, renderMailTemplate } from "./mail-templates";

const DIR = path.resolve(__dirname, "../mail-templates");
const preview = (id: string) => JSON.parse(fs.readFileSync(path.join(DIR, id, "preview.json"), "utf8"));

describe("the bilingual e-mail templates (krizaka-notifications format)", () => {
  it("render in English and French, with exactly their declared variables", () => {
    for (const id of Object.keys(MAIL_TEMPLATES) as MailTemplateId[]) {
      const declared = [...Object.keys(MAIL_TEMPLATES[id]), "product"].sort();
      for (const locale of MAIL_LOCALES) {
        const rendered = renderMailTemplate(id, preview(id), { locale, appUrl: "https://dev.akinaza.com", dir: DIR });
        expect(rendered.locale).toBe(locale);
        expect(rendered.subject.length).toBeGreaterThan(5);
        expect(rendered.html).toContain(`lang="${locale}"`);
        for (const file of ["subject.txt", "body.html", "body.txt"]) {
          const used = [...placeholdersOf(fs.readFileSync(path.join(DIR, id, locale, file), "utf8"))].sort();
          expect(used.every((name) => declared.includes(name)), `${id}/${locale}/${file}`).toBe(true);
        }
      }
    }
  });

  it("never promises to file or transmit a tax return, in either language", () => {
    for (const id of Object.keys(MAIL_TEMPLATES) as MailTemplateId[]) {
      for (const locale of MAIL_LOCALES) {
        const r = renderMailTemplate(id, preview(id), { locale, appUrl: "https://dev.akinaza.com", dir: DIR });
        expect(`${r.subject} ${r.text}`).not.toMatch(/e-?fil|t[ée]l[ée]transm|transmis|file your return|produit pour vous/i);
      }
    }
  });

  it("states the invoice and its taxes in the client's language; escapes HTML", () => {
    const fr = renderMailTemplate("invoice-issued", preview("invoice-issued"), { locale: "fr", appUrl: "https://x", dir: DIR });
    expect(fr.subject).toBe("Facture F-00001 de Salon Laurier — 160,97 $");
    expect(fr.text).toContain("dont TPS 7,00 $ et TVQ 13,97 $");
    expect(fill("<p>{shop}</p>", { shop: "<b>" }, { html: true, allowed: ["shop"], name: "t" })).toBe("<p>&lt;b&gt;</p>");
  });
});
