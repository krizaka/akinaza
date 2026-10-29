import { invoiceState } from "@akinaza/core";
import { KrizakaQueryProvider } from "@krizaka/query";
import { dataTableLabels } from "@krizaka/ui/data-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { type InvoiceRowView, InvoicesTable } from "./InvoicesTable";
import { ShopSession } from "./ShopSession";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app", useSearchParams: () => new URLSearchParams() }));

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
const markup = (locale: "en" | "fr") =>
    renderToStaticMarkup(
      <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
        <KrizakaQueryProvider>
          <ShopSession locale={locale} shopId="s1" remembered>
            <InvoicesTable invoices={rows} today="2026-10-23" />
          </ShopSession>
        </KrizakaQueryProvider>
      </I18nProvider>,
    );
const render = (locale: "en" | "fr") => readable(markup(locale));

const organize = { kind: "invoice" as const, canWrite: true, tags: [{ id: "t1", name: "À relancer", marker: "amber" as const }], counts: { t1: 2 }, views: { system: [{ key: "overdue", label: { fr: "En retard", en: "Overdue" }, filters: { status: ["overdue"] } }], workspace: [], mine: [] }, filters: {}, view: null };
const organised = () =>
  renderToStaticMarkup(
    <I18nProvider locale="fr" messages={MESSAGES.fr as never}>
      <KrizakaQueryProvider>
        <ShopSession locale="fr" shopId="s1" remembered>
          <InvoicesTable invoices={rows} today="2026-10-23" organize={organize} tagsByInvoice={{ "i-A-0002": organize.tags }} />
        </ShopSession>
      </KrizakaQueryProvider>
    </I18nProvider>,
  );

describe("the invoices list organised (akinaza#337)", () => {
  it("draws the tags' dividers with their counts, the tags on the rows and the system views as links holding the filters", () => {
    const html = organised();
    expect(readable(html)).toMatch(/Tous[\s\S]*À relancer\s*2/);
    expect(html).toContain('data-marker="amber"');
    expect(html).toContain('href="/fr/app?tags=t1"');
    expect(html).toContain("status=overdue");
    expect(html).toContain("view=overdue");
  });

  it("draws the derived state with the package's StatusChip over the administrator's status set, read-only (krizaka-ui#627)", () => {
    const status = { key: "invoice_state", label: { fr: "État", en: "State" }, mode: "derived" as const, states: [{ key: "paid", label: { fr: "Payée", en: "Paid" }, tone: "success" as const }, { key: "overdue", label: { fr: "En retard", en: "Overdue" }, tone: "danger" as const }, { key: "due", label: { fr: "À payer", en: "Due" }, tone: "neutral" as const }, { key: "partial", label: { fr: "Payée en partie", en: "Partly paid" }, tone: "accent" as const }, { key: "cancelled", label: { fr: "Annulée", en: "Cancelled" }, tone: "neutral" as const }, { key: "credit", label: { fr: "Note de crédit", en: "Credit note" }, tone: "neutral" as const }], transitions: [] };
    const html = renderToStaticMarkup(
      <I18nProvider locale="fr" messages={MESSAGES.fr as never}>
        <KrizakaQueryProvider>
          <ShopSession locale="fr" shopId="s1" remembered>
            <InvoicesTable invoices={rows} today="2026-10-23" organize={{ ...organize, status }} />
          </ShopSession>
        </KrizakaQueryProvider>
      </I18nProvider>,
    );
    expect(html).toMatch(/data-invoice="i-A-0002" data-state="overdue"[^>]*>[\s\S]*?En retard/);
    expect(html).not.toMatch(/<button[^>]*aria-label="[^"]*statut/i);
  });

  it("offers no way to move an invoice's state by hand: it is derived from the ledger", () => {
    const text = readable(organised());
    expect(text).not.toMatch(/Marquer (comme )?pay|Mark (as )?paid/i);
  });
});

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

/** The English words @krizaka/ui's DataTable falls back on (krizaka-ui#595): none may show in a French render. */
const ENGLISH_DEFAULTS = [
  ...Object.values(dataTableLabels).filter((v): v is string => typeof v === "string"),
  dataTableLabels.expandRow("X").replace("X", ""),
  dataTableLabels.results(3).replace("3", "").trim(),
  dataTableLabels.search("X").replace("X", ""),
  dataTableLabels.showMore("X").replace("X", ""),
  dataTableLabels.removeFilter("X").replace("X", ""),
].filter((w) => w.trim().length > 3 && !["Clients"].includes(w.trim()));

describe("Factures in French (D2, review K3): the chrome, the columns, the derived state, overdue first", () => {
  it("shows no English default label of the table in a French render", () => {
    const html = markup("fr");
    for (const word of ENGLISH_DEFAULTS) expect(html, word).not.toContain(word);
  });

  it("has no « Mois » column: the issue date says it", () => {
    expect(render("fr")).not.toMatch(/\bMois\b/);
    expect(render("en")).not.toMatch(/\bMonth\b/);
  });

  it("shows each invoice's state as a chip equal to invoiceState (due, partial, overdue, paid, credit, cancelled)", () => {
    const html = markup("fr");
    const known = [...rows, row("A-0006", { dueOn: "2026-11-30" })];
    const all = renderToStaticMarkup(
      <I18nProvider locale="fr" messages={MESSAGES.fr as never}>
        <KrizakaQueryProvider>
          <ShopSession locale="fr" shopId="s1" remembered>
            <InvoicesTable invoices={known} today="2026-10-23" />
          </ShopSession>
        </KrizakaQueryProvider>
      </I18nProvider>,
    );
    const chips = [...all.matchAll(/data-invoice="([^"]+)" data-state="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    const expected = known.map((i) => [i.id, invoiceState({ ...i, isCredit: !!i.creditOf }, "2026-10-23")]);
    expect(new Set(chips.map((c) => c[1]))).toEqual(new Set(["paid", "overdue", "partial", "cancelled", "credit", "due"]));
    for (const pair of expected) expect(chips).toContainEqual(pair);
    expect(html).toContain('data-state="overdue"');
  });

  it("puts the overdue invoices first, then the newest", () => {
    const order = [...markup("fr").matchAll(/data-invoice="i-(A-\d+)"/g)].map((m) => m[1]);
    expect(order[0]).toBe("A-0002");
  });

  it("washes a changed row once (D11): the list is a flash arrival, and nothing washes on the page's arrival", () => {
    const html = markup("fr");
    expect(html).toMatch(/<div[^>]*data-kz-arrival="flash"/);
    expect(html).not.toContain("data-kz-arrive=");
  });
});


describe("the columns' widths (akinaza#581)", () => {
  // The table reads a column's role from its `type`: « title » takes the remaining width (w-full), « link » stays at its content.
  const cellOf = (html: string, label: string) => {
    const found = [...html.matchAll(/<td\b[^>]*data-label="([^"]*)"[^>]*class="([^"]*)"/g)].find((m) => m[1] === label);
    return found?.[2] ?? "";
  };

  it("the client takes the width, the number stays narrow", () => {
    const html = markup("en");
    expect(cellOf(html, en.console.invoices.table.client)).toMatch(/w-full/);
    expect(cellOf(html, en.console.invoices.table.number)).not.toMatch(/w-full/);
  });

  it("the dates stay on one line", () => {
    const html = markup("en");
    for (const label of [en.console.invoices.table.issued, en.console.invoices.table.due]) expect(cellOf(html, label), label).toMatch(/whitespace-nowrap/);
  });
});
