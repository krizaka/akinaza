import { describe, expect, it, vi } from "vitest";

import type { ClientsQuery } from "@/lib/clients-view";
import { renderIn } from "@/lib/test-i18n";

import { ClientsCatalogue } from "./ClientsCatalogue";
import { ShopSession } from "./ShopSession";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app/s1/clients" }));

const row = (id: string, fullName: string, over = {}) => ({ id, fullName, email: null, phone: null, visits: 2, lastVisitAt: "2026-10-01T14:00:00.000Z", nextVisitAt: null, spentCents: 10_000, owedCents: 0, ...over });
const clients = [row("c1", "Studio Lumen inc.", { owedCents: 3_174 }), row("c2", "Atelier Boréal inc.", { nextVisitAt: "2026-10-30T14:00:00.000Z" })];
const render = (query: ClientsQuery = { q: "", filter: "all" }) => renderIn("fr", "professional", <ShopSession locale="fr" shopId="s1" remembered><ClientsCatalogue clients={clients} query={query} timeZone="America/Toronto" /></ShopSession>);
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("Clients on the catalogue template (D5)", () => {
  it("opens on the plan strip: how many clients, what they owe, how many are up to date", () => {
    const text = readable(render());
    expect(text).toContain("2 clients");
    expect(text).toMatch(/31,74\s\$/);
    expect(text).toContain("1 sur 2 à jour");
  });

  it("keeps the filters in the address, each chip with its count, the current one marked", () => {
    const html = render({ q: "lumen", filter: "due" });
    expect(html).toMatch(/href="\/fr\/app\/s1\/clients\?q=lumen"[^>]*>[\s\S]*?Tous[\s\S]*?2/);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/fr\/app\/s1\/clients\?q=lumen&amp;filter=due"|href="\/fr\/app\/s1\/clients\?q=lumen&amp;filter=due"[^>]*aria-current="page"/);
    expect(readable(html)).toContain("Reste dû 1");
  });

  it("shows each client's state and a « Facturer » action to their new invoice", () => {
    const html = render();
    expect(readable(html)).toMatch(/Reste dû 31,74\s\$/);
    expect(readable(html)).toContain("À jour");
    expect(html).toContain('href="/fr/app/s1/invoices/new?client=c1"');
  });

  it("says when the search finds no one, with the way back", () => {
    const html = renderIn("fr", "professional", <ShopSession locale="fr" shopId="s1" remembered><ClientsCatalogue clients={clients} query={{ q: "zzz", filter: "all" }} timeZone="America/Toronto" /></ShopSession>);
    expect(readable(html)).toContain("Aucun client ne correspond");
  });
});
