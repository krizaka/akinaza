import { org } from "@krizaka/org";
import { describe, expect, it } from "vitest";

import enRaw from "../messages/en.json";
import frRaw from "../messages/fr.json";
import { bindProduct } from "./brand";
import { format } from "./i18n";
import { publisherVars } from "./publisher";

const enMessages = bindProduct(enRaw);
const frMessages = bindProduct(frRaw);

describe("publisher (akinaza#375): the legal facts come from @krizaka/org", () => {
  it("reads the legal name, the city and the region from the org JSON", () => {
    expect(publisherVars()).toEqual({ publisher: org.company.legalName, city: org.company.city, region: org.company.region });
  });

  it("no catalogue hand-writes the publisher's legal name", () => {
    for (const messages of [enMessages, frMessages]) {
      expect(JSON.stringify(messages)).not.toContain(org.company.legalName);
    }
  });

  it("the legal pages' messages use the placeholders", () => {
    expect(enMessages.terms.sections[0]!.p).toContain("{publisher}");
    expect(frMessages.privacy.officer.text).toContain("{publisher}");
  });

  it("the rendered legal text names the publisher and the city", () => {
    const text = format(frMessages.terms.sections[0]!.p, publisherVars());
    expect(text).toContain(`${org.company.legalName} (${org.company.city}, ${org.company.region})`);
    expect(text).not.toContain("{");
  });
});
