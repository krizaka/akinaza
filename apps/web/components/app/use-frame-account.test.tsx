import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { useFrameAccount } from "./use-frame-account";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/en/shops/s-1" }));
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say: (key: string) => ({ "shell.yourAccount": "Your account" })[key] ?? key }) }));

const accountOf = (name: string | null) => {
  let seen: ReturnType<typeof useFrameAccount>["account"] | undefined;
  const Probe = () => {
    seen = useFrameAccount({ locale: "en", email: "camille@example.com", name, profileHref: "/en/profile" }).account;
    return null;
  };
  renderToStaticMarkup(
    <KrizakaQueryProvider>
      <Probe />
    </KrizakaQueryProvider>,
  );
  return seen!;
};

/** CTO decision (#431 follow-up): no name, the menu says « Your account » and shows the address; the header itself never prints the address (K6). */
describe("the account of the frame's menu", () => {
  it("with no name says « Your account » and shows the e-mail as the menu's identity line", () => {
    for (const name of [null, ""]) {
      const account = accountOf(name);
      expect(account.name).toBe("Your account");
      expect(account.email).toBe("camille@example.com");
    }
  });

  it("with a name keeps the name, and the e-mail below it", () => {
    const account = accountOf("Camille");
    expect(account.name).toBe("Camille");
    expect(account.email).toBe("camille@example.com");
  });

  it("never uses the e-mail as the name, so the header cannot print it", () => {
    expect(accountOf(null).name).not.toContain("@");
  });
});
