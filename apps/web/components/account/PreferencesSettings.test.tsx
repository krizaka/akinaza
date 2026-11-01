import { ThemeProvider } from "@krizaka/ui/theme";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { bindProduct } from "@/lib/brand";
import { I18nProvider } from "@/lib/i18n-client";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { PreferencesSettings } from "./PreferencesSettings";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => undefined }) }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const render = (locale: "en" | "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <ThemeProvider defaultMode="dark">
        <PreferencesSettings preferences={{ locale }} />
      </ThemeProvider>
    </I18nProvider>,
  );

describe("Appearance in the settings (krizaka-ui#657, ADR-006 §4)", () => {
  it("offers System, Light and Dark plus the optional Blueprint and Carbon surfaces, in the page's language", () => {
    const html = render("fr");
    for (const word of ["Comme mon appareil", "Clair", "Sombre", "Plan marine", "Carbone", "Densité", "Compacte"]) expect(html, word).toContain(word);
  });

  it("never offers the Cahier papers of the public shop pages, an accent row or a sound", () => {
    const html = render("en");
    expect(html).not.toMatch(/Séyès|Seyes|Kraft|Washi/i);
    expect(html).not.toContain("Accent colour");
    expect(html).not.toContain("Sound");
    expect(html).toContain("Blueprint");
  });
});
