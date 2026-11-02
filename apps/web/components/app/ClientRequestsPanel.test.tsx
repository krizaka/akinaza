import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { bindProduct } from "@/lib/brand";
import { I18nProvider } from "@/lib/i18n-client";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { ClientRequestsPanel, type ShopRequestView } from "./ClientRequestsPanel";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const request: ShopRequestView = {
  id: "r1",
  title: "Coupe + balayage",
  note: "Comme la dernière fois",
  service: { fr: "Coupe", en: "Haircut" },
  staffName: "Camille",
  files: [
    { id: "f1", url: "https://cdn.example/user/akinaza/shops/s/requests/r1/a.jpg", kind: "image" },
    { id: "f2", url: "https://cdn.example/user/akinaza/shops/s/requests/r1/b.pdf", kind: "pdf" },
  ],
};
const render = (requests: ShopRequestView[], locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <ClientRequestsPanel requests={requests} />
    </I18nProvider>,
  );

describe("the shop sees what the client keeps (akinaza#210)", () => {
  it("each request with its service, person, note and files to open — read only", () => {
    const html = render([request]);
    for (const text of ["Ses demandes gardées", "Coupe + balayage", "Coupe · Camille", "Comme la dernière fois", "Photo 1", "Document 2"]) expect(html).toContain(text);
    expect(html).toContain('href="https://cdn.example/user/akinaza/shops/s/requests/r1/b.pdf"');
    expect(html).not.toMatch(/<button|<form/);
    expect(render([request], "en")).toContain("Haircut · Camille");
  });

  it("nothing at all when the client keeps nothing", () => {
    expect(render([])).toBe("");
  });
});
