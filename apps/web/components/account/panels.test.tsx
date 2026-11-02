import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { bindProduct } from "@/lib/brand";
import { I18nProvider } from "@/lib/i18n-client";
import enRaw from "@/messages/en.json";

import { DataPanel } from "./DataPanel";
import { ProfileSettings, type ProfileView } from "./ProfileSettings";
import { SessionsPanel } from "./SessionsPanel";
import { SubscriptionPanel } from "./SubscriptionPanel";

const en = bindProduct(enRaw);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app/profile" }));

const around = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <I18nProvider locale="en" messages={{ console: en.console } as never}>
      <KrizakaQueryProvider>{node}</KrizakaQueryProvider>
    </I18nProvider>,
  );
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const sessions = [
  { id: "1", createdAt: "2026-10-20T12:00:00.000Z", ip: "10.0.0.1", userAgent: "Firefox on Mac", current: true },
  { id: "2", createdAt: "2026-10-18T12:00:00.000Z", ip: null, userAgent: null, current: false },
];

describe("the account's other sections", () => {
  it("flags this device among the sign-ins and offers to end the others, counted", () => {
    const page = text(around(<SessionsPanel sessions={sessions} />));
    expect(page).toContain("This device");
    expect(page).toContain("Unknown device");
    expect(page).toContain("Sign out the 1 others");
  });

  it("offers no sign-out when this is the only sign-in", () => {
    expect(text(around(<SessionsPanel sessions={sessions.slice(0, 1)} />))).not.toContain("Sign out the");
  });

  it("downloads the data as a file and asks the password before deleting", () => {
    const html = around(<DataPanel signInHref="/en/sign-in" />);
    expect(html).toContain('href="/api/me/account-export"');
    expect(html).toContain("download");
    expect(text(html)).toContain("Delete my account");
    expect(html).toContain('type="password"');
  });

  it.each([
    ["an active subscription with its page", { active: true, periodEnd: "2026-11-22T00:00:00.000Z", hasCustomer: true, offer: null }, ["Active", "Open the payment page"], ["Choose this offer"]],
    ["the founder offer on sale", { active: false, periodEnd: null, hasCustomer: false, offer: { price: "$39", cardRate: "0%" } }, ["No subscription", "Choose this offer", "$39 a month plus taxes, 0% on cards"], ["Open the payment page"]],
    ["nothing on sale", { active: false, periodEnd: null, hasCustomer: false, offer: null }, ["No plan is on sale yet."], ["Choose this offer", "Open the payment page"]],
  ] as const)("%s", (_name, subscription, shown, hidden) => {
    const page = text(around(<SubscriptionPanel subscription={subscription} />));
    for (const word of shown) expect(page).toContain(word);
    for (const word of hidden) expect(page).not.toContain(word);
  });
});

describe("the profile (docs/ux/2026-10-full-review.md K6): picture, name, e-mail ✓, member since, role", () => {
  const base: ProfileView = { id: "a-1", email: "lea@example.test", name: "Léa Tremblay", avatarSeed: "3", emailVerified: true, pendingEmail: null, memberSince: "Member since October 2026", role: "Owner at Pattes de Saint-Henri" };
  /** The text of each h2–h4: its text nodes joined (no tag stripping). */
  const heading = (html: string) => html.match(/<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/g)?.map((h) => (h.match(/>([^<]*)</g) ?? []).map((n) => n.slice(1, -1)).join("").trim()) ?? [];

  it("heads the identity card with the name, the verified e-mail on its own line, since when, and a name field and the picture choice", () => {
    const html = around(<ProfileSettings profile={base} />);
    const page = text(html);
    expect(heading(html)).toContain("Léa Tremblay");
    expect(page).toContain("lea@example.test");
    expect(page).toContain("Verified");
    expect(page).toContain("Member since October 2026");
    expect(html).toMatch(/<input[^>]*id="account-name"[^>]*value="Léa Tremblay"/);
    expect(html).toContain('role="radiogroup"');
  });

  it("never heads the card with the e-mail when there is no name yet", () => {
    const html = around(<ProfileSettings profile={{ ...base, name: null }} />);
    expect(heading(html)).toContain("No name yet");
    expect(heading(html).some((h) => h.includes("@"))).toBe(false);
  });

  it("checks no picture while the account wears the derived one, and gives the section its own line", () => {
    const html = around(<ProfileSettings profile={{ ...base, avatarSeed: null }} />);
    expect(html).not.toMatch(/role="radio"[^>]*aria-checked="true"/);
    expect(around(<ProfileSettings profile={base} />)).toMatch(/role="radio"[^>]*aria-checked="true"/);
    expect(text(html)).toContain(en.console.account.profile.profileDescription);
    expect(text(html)).not.toContain(en.console.account.profile.description);
  });

  it("speaks to a client alone: no team, no role row (akinaza#440)", () => {
    const html = text(around(<ProfileSettings profile={{ ...base, role: null }} />));
    expect(html).toContain(en.console.account.profile.profileDescriptionClient);
    expect(html).toContain(en.console.account.name.hintClient);
    expect(html).not.toMatch(/your team/i);
    expect(html).not.toContain(en.console.account.profile.role);
    expect(around(<ProfileSettings profile={{ ...base, role: null }} />)).not.toContain("account-role");
  });

  it.each([
    ["the owner", "Owner at Pattes de Saint-Henri"],
    ["a staff member", "Staff at Pattes de Saint-Henri"],
  ])("says the role of %s, read only", (_who, role) => {
    const html = around(<ProfileSettings profile={{ ...base, role }} />);
    expect(html).toMatch(new RegExp(`data-testid="account-role"[^>]*>${role}<`));
  });
});
