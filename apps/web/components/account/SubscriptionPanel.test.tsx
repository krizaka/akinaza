import { describe, expect, it, vi } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { SubscriptionPanel, type SubscriptionView } from "./SubscriptionPanel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const base: SubscriptionView = { active: false, periodEnd: null, hasCustomer: false, offer: null };
const plans: SubscriptionView["plans"] = [
  { id: "starter", price: "$29", trial: { months: 3, days: 90 } },
  { id: "scale", price: "$69", trial: null },
  { id: "association", price: "$1", trial: { months: 3, days: 90 } },
];
const render = (locale: "en" | "fr", view: Partial<SubscriptionView>) => renderIn(locale, "professional", <SubscriptionPanel subscription={{ ...base, ...view }} />);

describe("the subscription page offers the catalogue's plans with their free months", () => {
  it("Starter says its free months then its price, taxes stated; Pro has no free period", () => {
    const html = render("en", { plans });
    expect(html).toContain("3 months free, then $29 a month plus taxes.");
    expect(html).toContain("$69 a month plus taxes.");
    expect(html).toContain("Start the free period");
  });

  it("says « 3 mois offerts » in French", () => {
    expect(render("fr", { plans }).replace(/\u202f|\u00a0/g, " ")).toContain("3 mois offerts, puis $29 par mois, taxes en sus.");
  });

  it("the Association plan asks for a proof until approved, waits while pending, and opens once approved", () => {
    expect(render("en", { plans, association: { status: null, note: null } })).toContain("Send the proof");
    const pending = render("en", { plans, association: { status: "pending", note: null } });
    expect(pending).toContain("Waiting for review.");
    expect(pending).not.toContain("Send the proof");
    const approved = render("en", { plans, association: { status: "approved", note: null } });
    expect(approved).toContain("Approved: the Association plan is available.");
    expect(approved).not.toContain("Send the proof");
    expect(render("en", { plans, association: { status: "rejected", note: "Number not found." } })).toContain("Not approved: Number not found.");
  });

  it("a subscription in its free period says when the first charge happens", () => {
    const html = render("en", { active: true, hasCustomer: true, periodEnd: "2027-01-30T12:00:00.000Z", trialEndsAt: "2027-01-30T12:00:00.000Z" });
    expect(html).toContain("Free until");
    expect(html).toContain("unless you cancel before");
  });
});
