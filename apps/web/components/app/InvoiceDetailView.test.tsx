import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import { shopRoutes } from "@/lib/routes";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { invoice } from "./invoice-fixture";
import { InvoiceDetailView, type InvoiceDetailViewProps } from "./InvoiceDetailView";
import type { InvoiceView } from "./InvoiceDocument";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app/s1/invoices/i1" }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const base: InvoiceDetailViewProps = {
  invoice: invoice(),
  deliveries: [],
  locale: "fr",
  routes: shopRoutes("fr", "s1"),
  today: "2026-10-23",
};
const render = (props: Partial<InvoiceDetailViewProps> = {}) => {
  const p = { ...base, ...props };
  return renderToStaticMarkup(
    <I18nProvider locale={p.locale} messages={MESSAGES[p.locale] as never}>
      <KrizakaQueryProvider>
        <InvoiceDetailView {...p} />
      </KrizakaQueryProvider>
    </I18nProvider>,
  );
};
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("an invoice on DetailLayout (D2, review K3)", () => {
  it("has one h1, the invoice's number", () => {
    const html = render();
    const h1s = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) ?? [];
    expect(h1s).toHaveLength(1);
    expect(readable(h1s[0]!).trim()).toBe("KZ-00004");
  });

  it.each([
    ["due", {}],
    ["partial", { paidCents: 100_000 }],
    ["overdue", { dueOn: "2026-10-22" }],
    ["paid", { paidCents: 609_368 }],
    ["credit", { creditOf: "i0", termsDays: null, dueOn: null }],
    ["cancelled", { creditedBy: { id: "i9", number: "KZ-00009" } }],
  ] as const)("shows the state %s as its chip, the list's invoiceState", (state, over) => {
    const html = render({ invoice: invoice(over as Partial<InvoiceView>) });
    expect(html.match(/data-state="([a-z]+)"/)?.[1]).toBe(state);
  });

  it("makes « Envoyer la facture » the one primary, « Modifier » and « Imprimer » secondary", () => {
    const html = render({ invoice: invoice({ clientId: "c1" }) });
    const primaries = html.match(/<button[^>]*data-primary[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(primaries).toHaveLength(1);
    expect(readable(primaries[0]!)).toContain("Envoyer la facture");
    expect(readable(html)).toContain("Modifier");
    expect(readable(html)).toContain("Imprimer");
  });

  it("keeps the deliveries and the chain in the aside", () => {
    const html = render({ invoice: invoice({ replaces: { id: "i0", number: "KZ-00003" } }) });
    const text = readable(html);
    // The aside comes after the document: the deliveries, then the chain.
    expect(text.indexOf("pas encore été envoyée")).toBeGreaterThan(text.indexOf("Total (CAD)"));
    expect(text.indexOf("Remplace la facture KZ-00003")).toBeGreaterThan(text.indexOf("pas encore été envoyée"));
  });

  it("shows money from integer cents in the invoice's language", () => {
    expect(readable(render())).toMatch(/6[\s\u00a0\u202f]093,68[\s\u00a0\u202f]\$/);
  });

  it("speaks English around an English screen, the document keeping its own language", () => {
    const text = readable(render({ locale: "en", routes: shopRoutes("en", "s1") }));
    expect(text).toContain("Print");
    expect(text).toContain("Conditions de paiement");
  });

  it("after issuing, says the number with the beaver (success), and « Envoyer » stays the next primary (D3)", () => {
    const html = render({ invoice: invoice({ clientId: "c1" }), issued: true });
    expect(readable(html)).toContain("Facture KZ-00004 émise");
    const before = html.slice(0, html.indexOf("émise"));
    expect(before.lastIndexOf("<svg")).toBeGreaterThan(before.lastIndexOf("</h1>")); // the beaver, drawn in the alert
    expect(html.match(/data-primary/g)).toHaveLength(1);
    expect(readable(render())).not.toContain("émise");
  });
});
