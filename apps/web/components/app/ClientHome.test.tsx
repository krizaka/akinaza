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
  invoices: [{ id: `i-${id}`, number: "2026-0007", issuedOn: "2026-10-20", dueOn: "2026-11-19", totalCents: 3449, paidCents: 0, creditOf: null, superseded: false }],
  requests: { clientId: `c-${id}`, shopSlug: slug, requests: [], catalogue: null },
  now: "2026-10-24T12:00:00.000Z",
  today: "2026-10-24",
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

  it("lists the invoices as rows with their derived state and amount — never a raw « Ouvrir la facture » link (D7)", () => {
    const f = file("Studio Lumen inc. (démo)", "lumen");
    const html = render([
      {
        ...f,
        invoices: [
          { id: "i-paid", number: "KZ-00021", issuedOn: "2026-09-02", dueOn: "2026-10-02", totalCents: 31_043, paidCents: 31_043, creditOf: null, superseded: false },
          { id: "i-late", number: "KZ-00022", issuedOn: "2026-09-10", dueOn: "2026-10-10", totalCents: 11_498, paidCents: 0, creditOf: null, superseded: false },
          { id: "i-due", number: "KZ-00023", issuedOn: "2026-10-20", dueOn: "2026-11-19", totalCents: 3_449, paidCents: 0, creditOf: null, superseded: false },
        ],
      },
    ]);
    expect(text(html)).not.toMatch(/Ouvrir la facture/);
    expect([...html.matchAll(/data-state="(credit|cancelled|paid|partial|overdue|due)"/g)].map((m) => m[1])).toEqual(["paid", "overdue", "due"]);
    for (const [label, state] of [["Payée", "paid"], ["En retard", "overdue"], ["À payer", "due"]]) expect(html).toMatch(new RegExp(`data-state="${state}"[^>]*>${label}<`));
    expect(html).toContain('href="/fr/app/invoices/i-late"');
    expect(text(html)).toMatch(/KZ-00022 .*114,98/);
  });

  it("folds the request form behind « Garder une demande », a secondary that opens it in place; renewing is never a second primary", () => {
    const f = file("Studio Lumen inc. (démo)", "lumen");
    const request = { id: "r1", title: "Coupe et balayage", note: null, serviceId: "s1", serviceNameFr: "Coupe", serviceNameEn: "Cut", staffId: null, staffName: null, zoneId: null, files: [] };
    const html = render([{ ...f, requests: { ...f.requests, requests: [request], catalogue: { services: [{ id: "s1", nameFr: "Coupe", nameEn: "Cut" }], staff: [] } } }]);
    expect(html).not.toMatch(/<form[^>]*aria-label="Garder cette demande"/);
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*data-variant="secondary"[^>]*>Garder une demande<|<button[^>]*data-variant="secondary"[^>]*aria-expanded="false"[^>]*>Garder une demande</);
    expect(buttons(html).filter((b) => b.variant === "primary").map((b) => b.label)).toEqual(["Réserver chez Studio Lumen inc. (démo)"]);
    expect(buttons(html)).toContainEqual({ variant: "secondary", label: "Reprendre" });
  });

  it("gathers the data of every shop in one « Mes données » section at the end, a row per shop, « Effacer » away from the download", () => {
    const html = render([file("Pattes de Saint-Henri", "pattes"), file("Salon Rosemont", "rosemont")]);
    expect(html.match(/>Mes données</g)).toHaveLength(1);
    const section = html.slice(html.indexOf(">Mes données<"));
    expect(section).not.toContain("Réserver chez");
    const downloads = [...section.matchAll(/href="\/api\/me\/export\?clientId=(c-\w+)"/g)].map((m) => m[1]);
    expect(downloads).toEqual(["c-pattes", "c-rosemont"]);
    const lastDownload = section.lastIndexOf("/api/me/export");
    const firstErase = section.indexOf(">Effacer mon dossier chez");
    expect(firstErase).toBeGreaterThan(lastDownload);
    expect(section.slice(lastDownload, firstErase)).toMatch(/<h3[^>]*>Effacer un dossier<\/h3>/);
    expect(section.match(/>Effacer mon dossier chez /g)).toHaveLength(2);
    // A short word on the row, so a long shop name keeps its room at 360 px; the full sentence for a screen reader.
    expect(section).toMatch(/<a[^>]*aria-label="Télécharger mes données chez Salon Rosemont"[^>]*>Télécharger<\/a>/);
  });
});
