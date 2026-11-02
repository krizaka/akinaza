import { LEXICON } from "@akinaza/core";

import webEn from "../../../web/messages/en.json";
import webFr from "../../../web/messages/fr.json";
import en from "../i18n/en.json";
import fr from "../i18n/fr.json";

describe("the phone's lexique reads the web catalogue's words", () => {
  it.each([["en", en, webEn], ["fr", fr, webFr]] as const)("%s: same terms, same definitions as the console's", (_l, phone, web) => {
    // The web catalogue carries the {product} placeholder; the phone, which cannot read the settings, has the commercial name.
    expect(phone.lexicon).toEqual(JSON.parse(JSON.stringify(web.console.lexicon).replaceAll("{product}", "Folioviv")));
    for (const term of LEXICON) expect((phone.lexicon.terms as Record<string, unknown>)[term.id]).toBeDefined();
  });
});
