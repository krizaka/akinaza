import type { ClientFile, ClientNote } from "@akinaza/db";
import { describe, expect, it, vi } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { ClientFilePanel, type ClientFilePanelProps } from "./ClientFilePanel";
import { ShopSession } from "./ShopSession";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app/s1/clients/c-9" }));

const file: ClientFile = {
  client: { id: "c-9", fullName: "Studio Lumen inc. (démo)", email: "contact@lumen.test", phone: "514-555-0111", language: "fr", notes: null, hasAccessNotes: false, since: "2026-01-12T15:00:00.000Z" },
  dependants: [],
  visits: [{ id: "v1", startsAt: "2026-10-19T14:00:00.000Z", endsAt: "2026-10-19T15:00:00.000Z", status: "done", service: { fr: "Atelier", en: "Workshop" }, staff: "Éric", priceCents: 15_000 }],
  invoices: [
    { id: "i1", number: "KZ-00007", issuedOn: "2026-10-19", dueOn: "2026-10-20", totalCents: 17_246, paidCents: 0, creditOf: null, superseded: false },
    { id: "i2", number: "KZ-00004", issuedOn: "2026-09-01", dueOn: "2026-10-01", totalCents: 5_000, paidCents: 5_000, creditOf: null, superseded: false },
  ],
};
const notes: ClientNote[] = [{ id: "n1", body: "Facture au nom de l'entreprise.", author: "Éric", createdAt: "2026-10-22T14:00:00.000Z" }];
const base: ClientFilePanelProps = { file, notes, tab: "summary", timeZone: "America/Toronto", nowIso: "2026-10-23T15:00:00.000Z", today: "2026-10-23", mayInvoice: true };
const render = (props: Partial<ClientFilePanelProps> = {}) => renderIn("fr", "professional", <ShopSession locale="fr" shopId="s1" remembered><ClientFilePanel {...base} {...props} /></ShopSession>);
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("a client's file on Show · detail (D5)", () => {
  it("names the client in the one h1, with their state and « Facturer ce client »", () => {
    const html = render();
    expect(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/g)?.map(readable)).toEqual([" Studio Lumen inc. (démo) "]);
    expect(readable(html)).toMatch(/Reste dû 172,46\s\$/);
    expect(html).toContain('href="/fr/app/s1/invoices/new?client=c-9"');
  });

  it("opens the binder's sections from the address: Résumé · Factures · Visites · Notes", () => {
    const html = render({ tab: "invoices" });
    for (const tab of ["summary", "invoices", "visits", "notes"]) expect(html).toContain(tab === "summary" ? 'href="/fr/app/s1/clients/c-9"' : `href="/fr/app/s1/clients/c-9?tab=${tab}"`);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/fr\/app\/s1\/clients\/c-9\?tab=invoices"|href="\/fr\/app\/s1\/clients\/c-9\?tab=invoices"[^>]*aria-current="page"/);
  });

  it("gives each invoice its derived state (invoiceState): overdue, paid", () => {
    const text = readable(render({ tab: "invoices" }));
    expect(text).toContain("KZ-00007");
    expect(text).toContain("En retard");
    expect(text).toContain("Payée");
  });

  it("keeps the signed notes in the column: the words, who, when, on one line, and a way to add one", () => {
    const html = render();
    const text = readable(html);
    expect(text).toContain("Facture au nom de l'entreprise.");
    expect(text).toMatch(/Éric · 22 oct\. 2026/);
    expect(html).toMatch(/<textarea[^>]*name="body"/);
  });

  it("writes the dates on one line", () => {
    expect(render({ tab: "visits" })).toMatch(/whitespace-nowrap[^>]*>[^<]*19 oct\. 2026/);
  });

  it("wears the client's tags with their markers beside the contact, and a way to edit them for those who write tags (akinaza#337)", () => {
    const organize = { kind: "client" as const, canWrite: true, tags: [{ id: "t1", name: "Fidèle", marker: "green" as const }, { id: "t2", name: "Entreprise", marker: "violet" as const }], counts: {}, views: { system: [], workspace: [], mine: [] }, filters: {}, view: null };
    const html = render({ organize, tags: [organize.tags[0]!] });
    expect(readable(html)).toContain("Fidèle");
    expect(html).toContain('data-tag-marker="green"');
    expect(readable(html)).toContain("Modifier les étiquettes");
    expect(readable(render({ organize: { ...organize, canWrite: false }, tags: [organize.tags[0]!] }))).not.toContain("Modifier les étiquettes");
  });

  it("opens on the profile banner (krizaka-ui#650) and draws the sections as the binder's dividers", () => {
    const html = render();
    expect(html).toMatch(/Client<\/[a-z]+>/);
    expect(html).toMatch(/data-variant="binder"|kz-tabs-binder|binder/);
  });
});
