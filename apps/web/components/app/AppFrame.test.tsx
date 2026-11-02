import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppFrame } from "./AppFrame";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/en/shops/s-1" }));
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say: (key: string, vars?: Record<string, string>) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key) }) }));

const ITEMS = ["overview", "users", "shops", "invoices", "ledger", "operations", "audit"] as const;
const html = renderToStaticMarkup(
  <KrizakaQueryProvider>
    <AppFrame locale="en" productName="Folioviv" email="camille@example.com" name="Camille" base="/en" items={[...ITEMS]}>
      <p>page</p>
    </AppFrame>
  </KrizakaQueryProvider>,
);
const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));

/** One decision for every Krizaka product (Oussama, 2026-10-23): the account menu is in the header at every width, never at the bottom of the rail. */
describe("the account menu of the administration's frame (the shared AppFrame, variant admin)", () => {
  it("is in the header, once, with no width on which it disappears", () => {
    expect(html.match(/aria-label="Account"/g)).toHaveLength(1);
    expect(header).toContain('aria-label="Account"');
    const classes = header.match(/<button[^>]*aria-label="Account"[^>]*class="([^"]*)"/)![1]!.split(" ");
    expect(classes.filter((c) => c === "hidden" || /^(sm|md|lg|max-\w+):hidden$/.test(c))).toEqual([]);
  });

  it("is not at the bottom of the rail", () => {
    expect(html).not.toContain("account-menu-rail");
    expect(html).not.toContain("shell.signedInAs");
  });
});

describe("the sections of the administration", () => {
  const rail = html.slice(0, html.indexOf("<header"));
  const items = rail.match(/<a[^>]*data-rail-item[^>]*>/g) ?? [];

  it("has every section on the rail, the section of the page marked as the current one", () => {
    expect(items).toHaveLength(ITEMS.length);
    expect(items.find((a) => a.includes('aria-current="page"'))).toContain('aria-label="shell.shops"');
  });

  it("says in the header that this is the administration, and keeps the content for the page (no h1 here)", () => {
    expect(html).toContain('data-variant="admin"');
    expect(header).toContain("Administration");
    expect(html).toContain('<main id="content"');
    expect(html).not.toMatch(/<h1[\s>]/);
  });
});
