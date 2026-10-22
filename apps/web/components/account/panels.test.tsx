import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";

import { DataPanel } from "./DataPanel";
import { SessionsPanel } from "./SessionsPanel";
import { SubscriptionPanel } from "./SubscriptionPanel";

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
    ["the founder offer on sale", { active: false, periodEnd: null, hasCustomer: false, offer: { price: "$39.00" } }, ["No subscription", "Choose this offer", "$39.00 a month"], ["Open the payment page"]],
    ["nothing on sale", { active: false, periodEnd: null, hasCustomer: false, offer: null }, ["No plan is on sale yet."], ["Choose this offer", "Open the payment page"]],
  ] as const)("%s", (_name, subscription, shown, hidden) => {
    const page = text(around(<SubscriptionPanel subscription={subscription} />));
    for (const word of shown) expect(page).toContain(word);
    for (const word of hidden) expect(page).not.toContain(word);
  });
});
