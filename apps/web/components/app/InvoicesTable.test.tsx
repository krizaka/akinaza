import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { type InvoiceRowView, InvoicesTable } from "./InvoicesTable";
import { ShopSession } from "./ShopSession";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app" }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const row = (number: string, patch: Partial<InvoiceRowView> = {}): InvoiceRowView => ({
  id: `i-${number}`,
  number,
  client: "Camille Roy",
  issuedOn: "2026-10-01",
  dueOn: "2026-10-31",
  language: "fr",
  creditOf: null,
  subtotalCents: 10_000,
  gstCents: 500,
  qstCents: 998,
  totalCents: 11_498,
  paidCents: 0,
  superseded: false,
  ...patch,
});
const rows = [row("A-0001", { paidCents: 11_498 }), row("A-0002", { dueOn: "2026-10-15" }), row("A-0003", { paidCents: 5_000 }), row("A-0004", { superseded: true }), row("A-0005", { creditOf: "i-A-0004", totalCents: -11_498 })];
const render = (locale: "en" | "fr") =>
  readable(
    renderToStaticMarkup(
      <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
        <KrizakaQueryProvider>
          <ShopSession locale={locale} shopId="s1" remembered>
            <InvoicesTable invoices={rows} today="2026-10-23" />
          </ShopSession>
        </KrizakaQueryProvider>
      </I18nProvider>,
    ),
  );

describe("the invoices list (akinaza#218)", () => {
  it("says where each invoice stands, in the shop's words", () => {
    const text = render("fr");
    for (const word of ["Payée", "En retard", "Payée en partie", "Annulée", "Note de crédit"]) expect(text).toContain(word);
    expect(render("en")).toContain("Partly paid");
  });

  it("offers the search, the columns and the CSV export in its toolbar", () => {
    const text = render("fr");
    expect(text).toMatch(/Export|Exporter/);
    expect(text).toContain("Reste dû");
  });
});
