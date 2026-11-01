import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import { emptyLine } from "@/lib/invoice-draft";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { InvoiceForm, type InvoiceFormProps, STICKY_CLEARS_TAB_BAR } from "./InvoiceForm";
import { ShopSession } from "./ShopSession";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app/s1/invoices/new" }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const base: InvoiceFormProps = {
  locale: "fr",
  data: {
    today: "2026-10-23",
    registrant: true,
    termsDays: 30,
    clients: [{ id: "c-1", fullName: "Studio Lumen inc. (démo)", language: "fr" }],
    services: [{ id: "s-hour", nameFr: "Développement (à l'heure)", nameEn: "Development (hourly)", priceCents: 15_000, taxCategory: "standard" }],
  },
  start: { clientId: "c-1", lines: [emptyLine("l0", "s-hour", "1.5")] },
};
const render = (props: Partial<InvoiceFormProps> = {}) => {
  const p = { ...base, ...props };
  return renderToStaticMarkup(
    <I18nProvider locale={p.locale} messages={MESSAGES[p.locale] as never}>
      <KrizakaQueryProvider>
        <ShopSession locale={p.locale} shopId="s1" remembered>
          <InvoiceForm {...p} />
        </ShopSession>
      </KrizakaQueryProvider>
    </I18nProvider>,
  );
};
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("Nouvelle facture (D3): numbered steps, lines added and removed, the total in view", () => {
  it("asks in three numbered steps: 01 Pour qui ? · 02 Quoi ? · 03 Quand ?", () => {
    const text = readable(render());
    const at = ["01 Pour qui ?", "02 Quoi ?", "03 Quand ?"].map((step) => text.indexOf(step));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain("le numéro est donné à l’émission");
  });

  it("opens with the client and the line of its address chosen", () => {
    const html = render();
    expect(html).toMatch(/<option value="c-1" selected="">/);
    expect(html).toMatch(/<option value="s-hour" selected="">/);
    expect(html).toMatch(/value="1\.5"/);
  });

  it("adds and removes lines with real buttons (the keyboard's), never removing the last one", () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>[\s\S]*?Ajouter une ligne/);
    expect(html).toMatch(/<button[^>]*aria-label="Retirer la ligne 1"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Retirer la ligne 1"/);
    const two = render({ start: { clientId: "", lines: [emptyLine("l0", "s-hour"), emptyLine("l1")] } });
    expect(two).toContain('aria-label="Retirer la ligne 2"');
    expect(two).not.toMatch(/aria-label="Retirer la ligne 1"[^>]*disabled/);
  });

  it("shows the server's total in fr-CA money: 1,5 h at 150 $ = 225,00 $ + TPS 11,25 $ + TVQ 22,44 $ = 258,69 $", () => {
    const text = readable(render());
    for (const amount of ["225,00 $", "11,25 $", "22,44 $", "258,69 $"]) expect(text).toContain(amount);
    expect(readable(render({ locale: "en" }))).toContain("$258.69");
  });

  it("holds the total and « Émettre la facture » in a sticky action above the phone's tab bar, and beside the form on a desktop", () => {
    const html = render();
    const sticky = html.match(/<div class="([^"]*sticky[^"]*)"[^>]*data-testid="invoice-sticky"/)?.[1] ?? "";
    for (const c of STICKY_CLEARS_TAB_BAR.split(" ")) expect(sticky).toContain(c);
    expect(html.match(/data-primary/g)).toHaveLength(2); // one per width: the aside's, the sticky one's
    expect(html).toContain('data-testid="invoice-aside"');
  });
});
