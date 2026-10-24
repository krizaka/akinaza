import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { type ClientFileView,ClientHome } from "./ClientHome";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/fr/app" }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const render = (files: ClientFileView[], locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <KrizakaQueryProvider>
      <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
        <ClientHome files={files} />
      </I18nProvider>
    </KrizakaQueryProvider>,
  );
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** The buttons and button links of a render, with their variant (the @krizaka/ui Button marks it). */
const buttons = (html: string) => [...html.matchAll(/<(?:a|button)\b[^>]*data-variant="(\w+)"[^>]*>(.*?)<\/(?:a|button)>/g)].map((m) => ({ variant: m[1]!, label: text(m[2]!).trim() }));

const file = (shopName: string, slug: string | null, id = slug ?? "x"): ClientFileView => ({
  client: { id: `c-${id}`, fullName: "Camille Tremblay", shopName, shopSlug: slug, businessType: "pets" },
  dogs: [],
  bookings: [
    { bookingId: `b-${id}`, status: "booked", visitStatus: "booked", startsAt: "2026-11-03T14:00:00.000Z", service: { fr: "Promenade", en: "Walk" }, zone: "Saint-Henri", dependantName: "Biscuit", report: null },
  ],
  invoices: [{ id: `i-${id}`, number: "2026-0007", issuedOn: "2026-10-20", totalCents: 3449, shopName }],
  requests: { clientId: `c-${id}`, shopSlug: slug, requests: [], catalogue: null },
  now: "2026-10-24T12:00:00.000Z",
  timeZone: "America/Toronto",
});

describe("the client space (K7, docs/ux/2026-10-full-review.md H2)", () => {
  it("names the frame « Mes réservations » in the one h1 — never an e-mail, never « Votre boutique »", () => {
    const html = render([file("Pattes de Saint-Henri", "pattes")]);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Mes réservations<\/h1>/);
    expect(text(html)).not.toMatch(/Votre boutique|Ma page boutique|@/);
  });

  it("empty: the EmptyState asks for the beaver at 120 px (drawn at its slot size until krizaka-ui#623), what will fill it, and « Ouvrir une boutique » as an action", () => {
    for (const locale of ["fr", "en"] as const) {
      const html = render([], locale);
      const t = MESSAGES[locale].console.client;
      expect(html).toMatch(/<svg[^>]*width="120"/);
      expect(text(html)).toContain(t.emptyTitle);
      expect(text(html)).toContain(t.emptyLead);
      expect(html).toContain(`href="/${locale}/app/open-shop"`);
      expect(buttons(html)).toEqual([{ variant: "secondary", label: t.openShop }]);
    }
  });

  it("one primary action per screen: booking again at the first shop; the others and « Ouvrir une boutique » are secondary", () => {
    const html = render([file("Pattes de Saint-Henri", "pattes"), file("Salon Rosemont", "rosemont")]);
    const primaries = buttons(html).filter((b) => b.variant === "primary");
    expect(primaries).toEqual([{ variant: "primary", label: "Réserver chez Pattes de Saint-Henri" }]);
    expect(buttons(html)).toContainEqual({ variant: "secondary", label: "Réserver chez Salon Rosemont" });
    expect(buttons(html)).toContainEqual({ variant: "secondary", label: "Ouvrir une boutique" });
  });

  it("says a booking's service alone when it has no zone, never a dash", () => {
    const f = file("Salon Rosemont", "rosemont");
    const html = render([{ ...f, bookings: f.bookings.map((b) => ({ ...b, zone: null })) }]);
    expect(text(html)).toContain(" Promenade ");
    expect(text(html)).not.toContain("Promenade · —");
  });

  it("gives the primary to the first shop with a page when the first has none", () => {
    const html = render([file("Ancienne boutique", null, "old"), file("Salon Rosemont", "rosemont")]);
    expect(buttons(html).filter((b) => b.variant === "primary").map((b) => b.label)).toEqual(["Réserver chez Salon Rosemont"]);
  });

  it("lists the bookings and invoices of every shop the client deals with, each invoice at the account's own address", () => {
    const html = render([file("Pattes de Saint-Henri", "pattes"), file("Salon Rosemont", "rosemont")], "en");
    expect(text(html)).toContain("Pattes de Saint-Henri");
    expect(text(html)).toContain("Salon Rosemont");
    expect(html).toContain('href="/en/app/invoices/i-pattes"');
    expect(html).toContain('href="/en/app/invoices/i-rosemont"');
    expect(text(html)).toContain("Biscuit · November 3, 2026");
    expect(text(html)).toContain("$34.49");
    expect(text(html)).toContain("Walk · Saint-Henri");
  });

  it("holds a 360 px phone: a long shop name wraps and the actions take the full width under it", () => {
    const html = render([file("Toilettage et pension canine du Plateau-Mont-Royal", "plateau")]);
    expect(html).toMatch(/<h2 class="[^"]*min-w-0[^"]*break-words[^"]*"[^>]*>Toilettage/);
    const erase = html.match(/<button[^>]*class="([^"]*)"[^>]*>Effacer mon dossier chez Toilettage/)![1]!.split(" ");
    for (const rule of ["whitespace-normal", "w-full", "sm:w-auto"]) expect(erase).toContain(rule);
    for (const label of ["Réserver chez Toilettage", "Ouvrir une boutique"]) expect(html).toMatch(new RegExp(`<a[^>]*class="[^"]*w-full sm:w-auto[^"]*"[^>]*>${label}`));
  });
});
