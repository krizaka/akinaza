import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { KrizakaQueryProvider } from "@krizaka/query";
import { PageHeader } from "@krizaka/ui/page-header";
import { Stat } from "@krizaka/ui/stat";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { BooksLines, type BooksLineView } from "./BooksLines";
import { invoice as invoiceFixture } from "./invoice-fixture";
import { InvoiceDocument } from "./InvoiceDocument";
import { type InvoiceRowView, InvoicesTable } from "./InvoicesTable";
import { ShopSession } from "./ShopSession";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app" }));

/**
 * The product register (krizaka/akinaza#327 and #352, ADR-006): Plus Jakarta Sans for titles (`--kz-font-product-display`, from
 * @krizaka/fonts ≥ 0.5), the text sans for the rest, a code mono only for identifiers, tabular digits on every amount. The
 * register comes from @krizaka/ui's product surface (`data-surface="product"` on the root, blocks.css 3.55), which this test
 * reads as shipped; the app keeps no local rule for it.
 */
const require = createRequire(import.meta.url);
const read = (spec: string) => readFileSync(require.resolve(spec), "utf8");
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const CAHIER_FACES = /Young Serif|Courier Prime|Krizaka Cahier/;

/** The last value of `prop` in a rule that targets the product surface itself (not a descendant of it). */
function productSurfaceValue(css: string, prop: string): string | undefined {
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const own = rules.filter(([, selector]) => /^:is\(\[data-surface="product"\][^)]*\)$/.test(selector!.trim()));
  return own.map(([, , body]) => new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(body!)?.[1]?.trim()).filter(Boolean).at(-1);
}

describe("the faces of the product register", () => {
  it("roots every page on the product surface, with @krizaka/ui's blocks loaded", () => {
    expect(source("../../app/[locale]/layout.tsx")).toMatch(/<html[^>]*data-surface="product"/);
    expect(source("../../app/[locale]/layout.tsx")).toContain('import "@krizaka/ui/blocks.css"');
  });

  it("resolves the display role to Plus Jakarta Sans and the mono role to a code mono, never a Cahier face", () => {
    const blocks = read("@krizaka/ui/blocks.css");
    expect(blocks.replace(/\/\*[\s\S]*?\*\//g, "")).toMatch(/--kz-font-display:\s*var\(--kz-font-product-display\)/);
    expect(read("@krizaka/tokens/tokens.css")).toMatch(/--kz-font-product-display:\s*"Plus Jakarta Sans"/);
    expect(read("@krizaka/fonts/css")).toContain('font-family: "Plus Jakarta Sans"');
    const mono = productSurfaceValue(blocks, "--kz-font-mono")!;
    expect(mono).toMatch(/^ui-monospace\b/);
    expect(mono).not.toMatch(CAHIER_FACES);
    expect(read("@krizaka/tokens/brands/akinaza.css")).not.toMatch(CAHIER_FACES);
  });

  it("draws PageHeader's h1 in the display role, its weight from the register (no local h1 rule)", () => {
    const html = renderToStaticMarkup(<PageHeader title="Factures" />);
    expect(html).toMatch(/<h1 class="[^"]*\bfont-display\b/);
    const globals = source("../../app/globals.css");
    expect(globals).not.toMatch(/h1\s*\{[^}]*font-weight/);
    expect(globals).toContain("@krizaka/fonts/css");
    expect(globals + source("../../app/[locale]/layout.tsx")).not.toMatch(/next\/font\/google|fonts\.googleapis/);
  });

  it("names no Cahier face in the app's own code", () => {
    for (const file of ["../../app/globals.css", "./ShopFrame.tsx", "./InvoiceDocument.tsx", "./BooksLines.tsx", "./InvoicesTable.tsx"]) {
      expect(source(file), file).not.toMatch(CAHIER_FACES);
      expect(source(file), file).not.toMatch(/font-cahier/);
    }
  });
});

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const MONEY = /\$\s?-?\d|\d\s?\$/;

/** Every element whose own text is an amount, with its class. */
function amounts(html: string): { text: string; className: string }[] {
  return [...html.matchAll(/<(\w+)((?:\s[^>]*)?)>([^<]+)<\/\1>/g)]
    .filter(([, , , text]) => MONEY.test(text!))
    .map(([, , attrs, text]) => ({ text: text!.trim(), className: /class="([^"]*)"/.exec(attrs ?? "")?.[1] ?? "" }));
}
const wrap = (locale: "en" | "fr", node: React.ReactNode) =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <ShopSession locale={locale} shopId="s1" remembered>
          {node}
        </ShopSession>
      </KrizakaQueryProvider>
    </I18nProvider>,
  );

const invoice = (number: string, patch: Partial<InvoiceRowView> = {}): InvoiceRowView => ({
  id: `i-${number}`, number, client: "Studio Lumen inc. (démo)", issuedOn: "2026-10-01", dueOn: "2026-10-31", language: "fr", creditOf: null,
  subtotalCents: 360_000, gstCents: 18_000, qstCents: 35_910, totalCents: 413_910, paidCents: 0, superseded: false, ...patch,
});
const lines: BooksLineView[] = [
  { line: "101", amountCents: 1_234_500, computed: false, sources: [{ kind: "invoice", id: "i1", label: "KZ-0001", amountCents: 1_234_500 }] },
  { line: "106", amountCents: 61_725, computed: true, sources: [] },
];

describe("tabular digits on every amount (Factures, Livres)", () => {
  it.each(["fr", "en"] as const)("the invoices list, in %s", (locale) => {
    const found = amounts(wrap(locale, <InvoicesTable invoices={[invoice("KZ-0001"), invoice("KZ-0002", { paidCents: 100_000 })]} today="2026-10-23" />));
    expect(found.length).toBeGreaterThan(0);
    for (const a of found) expect(a.className, a.text).toMatch(/\btabular-nums\b/);
  });

  it.each(["fr", "en"] as const)("the lines of the books, in %s", (locale) => {
    const found = amounts(wrap(locale, <BooksLines lines={lines} />));
    expect(found.length).toBeGreaterThan(0);
    for (const a of found) {
      expect(a.className, a.text).toMatch(/\btabular-nums\b/);
      expect(a.className, a.text).not.toMatch(/\bfont-mono\b/); // the code mono is for identifiers, not for amounts
    }
  });

  it.each(["fr", "en"] as const)("an invoice, in %s", (language) => {
    const doc = invoiceFixture({ language });
    const found = amounts(renderToStaticMarkup(<InvoiceDocument invoice={doc} locale={language} backHref="/fr/app/x/invoices" />));
    expect(found.length).toBeGreaterThanOrEqual(5);
    for (const a of found) {
      expect(a.className, a.text).toMatch(/\btabular-nums\b/);
      expect(a.className, a.text).not.toMatch(/\bfont-mono\b/);
    }
  });

  it("the books' stats", () => {
    expect(renderToStaticMarkup(<Stat label="TPS" value="617,25 $" />)).toMatch(/class="[^"]*\btabular-nums\b[^"]*">617,25 \$</);
  });
});
