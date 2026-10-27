import { describe, expect, it, vi } from "vitest";

import type { ClientsQuery } from "@/lib/clients-view";
import type { OrganizeData } from "@/lib/organize-view";
import { renderIn } from "@/lib/test-i18n";

import { ClientsCatalogue } from "./ClientsCatalogue";
import { ShopSession } from "./ShopSession";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/fr/app/s1/clients", useSearchParams: () => new URLSearchParams() }));

const row = (id: string, fullName: string, over = {}) => ({ id, fullName, email: null, phone: null, visits: 2, lastVisitAt: "2026-10-01T14:00:00.000Z", nextVisitAt: null, spentCents: 10_000, owedCents: 0, ...over });
const clients = [row("c1", "Studio Lumen inc.", { owedCents: 3_174 }), row("c2", "Atelier Boréal inc.", { nextVisitAt: "2026-10-30T14:00:00.000Z" })];
const organize = (over: Partial<OrganizeData> = {}): OrganizeData => ({ kind: "client", canWrite: true, tags: [{ id: "t1", name: "Fidèle", marker: "green" }, { id: "t2", name: "À rappeler", marker: "amber" }], counts: { t1: 1 }, views: { system: [], workspace: [], mine: [] }, filters: {}, view: null, ...over });
const tagged = { c1: [{ id: "t1", name: "Fidèle", marker: "green" as const }] };
const render = (query: ClientsQuery = { q: "", filter: "all" }, over: Partial<OrganizeData> = {}) => renderIn("fr", "professional", <ShopSession locale="fr" shopId="s1" remembered><ClientsCatalogue clients={clients} query={query} timeZone="America/Toronto" organize={organize(over)} tagsByClient={tagged} /></ShopSession>);
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
    const html = renderIn("fr", "professional", <ShopSession locale="fr" shopId="s1" remembered><ClientsCatalogue clients={clients} query={{ q: "zzz", filter: "all" }} timeZone="America/Toronto" organize={organize()} tagsByClient={{}} /></ShopSession>);
    expect(readable(html)).toContain("Aucun client ne correspond");
  });

  it("draws the binder's dividers per tag, each a link that holds the tag in the address, with its count (akinaza#337)", () => {
    const html = render();
    expect(readable(html)).toMatch(/Tous[\s\S]*Fidèle\s*1/);
    expect(html).toContain('href="/fr/app/s1/clients?tags=t1"');
    // A tag worn by nobody has no divider (review K3b: no tab at 0).
    expect(readable(html)).not.toContain("À rappeler");
    expect(html).not.toContain('href="/fr/app/s1/clients?tags=t2"');
  });

  it("shows a client's tags on its row with their marker, and the owner's « new tag » divider", () => {
    const html = render();
    expect(html).toContain('data-marker="green"');
    expect(readable(html)).toContain("Nouvelle étiquette");
    expect(readable(render(undefined, { canWrite: false }))).not.toContain("Nouvelle étiquette");
  });

  it("keeps the tags and the view in force when the search or the filter changes", () => {
    const html = render({ q: "", filter: "due" }, { filters: { tags: ["t1"] }, view: "mine1", views: { system: [], workspace: [], mine: [{ id: "mine1", kind: "client", authorId: "a", name: "Mes fidèles", filters: { tags: ["t1"] }, shared: false }] } });
    expect(html).toContain("tags=t1");
    expect(readable(html)).toContain("Mes fidèles");
    expect(html).toContain("view=mine1");
  });
});
