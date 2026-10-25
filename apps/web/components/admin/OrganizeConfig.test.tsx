import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { OrganizeConfig, type StoredKind } from "./OrganizeConfig";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const tags = { writers: ["owner", "manager"], userTags: false, max: 20, presets: { default: [{ name: "Fidèle", marker: "green" as const }], salon: [{ name: "Coloration", marker: "violet" as const }] } };
const client: StoredKind = { kind: "client", version: 3, config: { kind: "client", tags, status: null, views: [] } };
const invoice: StoredKind = {
  kind: "invoice",
  version: 1,
  config: { kind: "invoice", tags, views: [], status: { key: "invoice_state", label: { fr: "État", en: "State" }, mode: "derived", states: [{ key: "due", label: { fr: "À payer", en: "Due" }, tone: "neutral" }, { key: "paid", label: { fr: "Payée", en: "Paid" }, tone: "success" }], transitions: [] } },
};
const render = (stored: StoredKind, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <OrganizeConfig stored={stored} />
    </I18nProvider>,
  );

describe("the administrator's tags and statuses (krizaka-ui#690 editors)", () => {
  it("edits the tag set of a kind in French: who manages the tags, the sets by trade, the roles named", () => {
    const html = render(client);
    expect(html).toContain("Qui gère les étiquettes");
    expect(html).toContain("Gérant");
    expect(html).toContain("Fidèle");
    expect(html).toContain("salon");
    expect(html).not.toContain("Who manages the tags");
    expect(html).not.toContain("Ajouter un état");
  });

  it("shows the status set of a kind that has one, read-only because it is derived (the ledger moves it, nobody does)", () => {
    const html = render(invoice);
    expect(html).not.toContain("Ajouter un état");
    expect(html).toContain("Dérivé : Akinaza calcule cet état");
    expect(html).toContain("À payer");
  });

  it("saves in the page's language", () => {
    expect(render(client, "en")).toContain("Save");
    expect(render(client)).toContain("Enregistrer");
  });
});
