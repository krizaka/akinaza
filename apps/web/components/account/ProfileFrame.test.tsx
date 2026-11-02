import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { bindProduct } from "@/lib/brand";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { ProfileFrame } from "./ProfileFrame";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

type Props = Parameters<typeof ProfileFrame>[0];
const html = (props: Partial<Props> = {}) => renderToStaticMarkup(<ProfileFrame locale="fr" current="profile" account={{ name: null }} {...props}>contenu</ProfileFrame>);
const h1 = (page: string) => (page.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0].match(/>([^<]*)</g) ?? []).map((n) => n.slice(1, -1)).join("").trim();

describe("the account frame (docs/ux/2026-10-full-review.md K6)", () => {
  it("names the owner's role « Propriétaire » in French", () => {
    expect(fr.console.account.profile.shopRoles.owner).toBe("Propriétaire");
  });

  it("gives each section its address and marks the current one", () => {
    const page = html({ current: "security" });
    expect(page).toContain('href="/fr/app/profile"');
    const link = (href: string) => page.match(new RegExp(`<a[^>]*href="${href}"[^>]*>`))?.[0] ?? "";
    expect(link("/fr/app/profile/security")).toContain('aria-current="page"');
    expect(link("/fr/app/profile")).not.toContain("aria-current");
  });

  it("titles the page with the person's name once they gave one", () => {
    expect(h1(html({ account: { name: "Léa Tremblay" } }))).toBe("Léa Tremblay");
  });

  it("says « Mon compte » / « My account » without a name, never the e-mail", () => {
    expect(h1(html())).toBe("Mon compte");
    expect(h1(html({ locale: "en", account: { name: "  " } }))).toBe(en.console.account.profile.accountTitle);
    expect(html()).not.toMatch(/@/);
  });

  it("lists only the sections the role may open", () => {
    const staff = html({ sections: ["profile", "preferences", "security", "data"] });
    expect(staff).not.toContain('href="/fr/app/profile/subscription"');
    expect(html()).toContain('href="/fr/app/profile/subscription"');
  });
});
