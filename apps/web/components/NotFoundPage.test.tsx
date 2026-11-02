import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NotFoundPage } from "./NotFoundPage";

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("the 404 of an unknown address is branded, in the language of the address (krizaka/akinaza#299)", () => {
  it("/fr/nope: the code, the French words and the way back to the French home", () => {
    const html = renderToStaticMarkup(<NotFoundPage locale="fr" />);
    expect(text(html)).toContain("404");
    expect(text(html)).toContain("Page introuvable");
    expect(text(html)).toContain("Retour à Folioviv");
    expect(html).toContain('href="/fr"');
    expect(html).not.toContain("Page not found");
  });

  it("/en/nope: the English words", () => {
    const html = renderToStaticMarkup(<NotFoundPage locale="en" />);
    expect(text(html)).toContain("Page not found");
    expect(text(html)).toContain("Back to Folioviv");
    expect(html).toContain('href="/en"');
  });
});
