import { describe, expect, it, vi } from "vitest";

const found = vi.hoisted(() => ({ applied: [] as boolean[], mails: [] as { to: string; locale: string; subject: string; text: string }[], delivered: 0 }));
vi.mock("@akinaza/db", () => ({
  rejudgeShops: async (_db: unknown, _terms: unknown, o: { apply: boolean }) => (
    found.applied.push(o.apply),
    [
      { shopId: "s1", name: "Salon Laurier", slug: "login-laurier", matched: "login", ownerId: "o1", ownerEmail: "a@x.test", ownerLocale: "fr" },
      { shopId: "s2", name: "Toilettage", slug: "secure-toilettage", matched: "secure", ownerId: "o2", ownerEmail: "b@x.test", ownerLocale: "en" },
      { shopId: "s3", name: "Sans courriel", slug: "wallet-x", matched: "wallet", ownerId: null, ownerEmail: null, ownerLocale: "fr" },
    ]
  ),
  enqueueMail: async (_db: unknown, m: { to: string; locale: string; subject: string; text: string }) => (found.mails.push(m), `mail-${found.mails.length}`),
  mailById: async (_db: unknown, id: string) => ({ id }),
}));
vi.mock("./mail", () => ({ deliver: async () => (found.delivered++, "pending") }));
vi.mock("./slug-policy", () => ({ slugPolicy: async () => ({ terms: [] }) }));

import { rejudgeAndNotify } from "./slug-rejudge";

const settings = { provider: "none" as const, apiUrl: "http://x", appUrl: "https://www.akinaza.com" };
const now = new Date("2026-10-29T12:00:00Z");

describe("the one-off re-judging of the shops that predate the hold (ADR-005, #537)", () => {
  it("a dry run reports the shops and sends nothing", async () => {
    const report = await rejudgeAndNotify({} as never, { apply: false, now, settings });
    expect(found.applied).toEqual([false]);
    expect(report.shops.map((s) => s.slug)).toEqual(["login-laurier", "secure-toilettage", "wallet-x"]);
    expect(report.notified).toBe(0);
    expect(found.mails).toEqual([]);
  });

  it("apply tells each owner with an address, in their language, with the link to choose another address", async () => {
    const report = await rejudgeAndNotify({} as never, { apply: true, now, settings });
    expect(report.notified).toBe(2);
    expect(found.delivered).toBe(2);
    expect(found.mails.map((m) => [m.to, m.locale])).toEqual([["a@x.test", "fr"], ["b@x.test", "en"]]);
    expect(found.mails[0]!.subject).toContain("Salon Laurier");
    expect(found.mails[0]!.text).toContain("login-laurier");
    expect(found.mails[0]!.text).toContain("https://www.akinaza.com/fr/app/s1/boutique/page");
    expect(found.mails[1]!.text).toContain("stays private until we have checked it");
  });
});
