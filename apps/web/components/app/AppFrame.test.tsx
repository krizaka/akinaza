import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppFrame } from "./AppFrame";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/en/app" }));
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say: (key: string, vars?: Record<string, string>) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key) }) }));

const html = renderToStaticMarkup(
  <KrizakaQueryProvider>
    <AppFrame locale="en" email="camille@example.com" name="Camille" base="/en/app" items={["today", "clients"]}>
      <p>page</p>
    </AppFrame>
  </KrizakaQueryProvider>,
);

/** One decision for every Krizaka product (Oussama, 2026-10-23): the account menu is in the header at every width, never at the bottom of the rail. */
describe("the account menu of the app shell", () => {
  it("is in the header, once, with no width on which it disappears", () => {
    const header = html.match(/<div[^>]*data-testid="account-menu-header"[^>]*>/)![0];
    expect(html.match(/aria-label="shell\.account"/g)).toHaveLength(1);
    expect(html.indexOf("data-testid=\"account-menu-header\"")).toBeLessThan(html.indexOf("aria-label=\"shell.account\""));
    expect(header).not.toMatch(/hidden|md:/);
  });

  it("is not at the bottom of the rail", () => {
    expect(html).not.toContain("account-menu-rail");
    expect(html).not.toContain("shell.signedInAs");
  });
});
