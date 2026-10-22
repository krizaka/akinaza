import type { ShopRecommendation } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { daysInWords } from "./brief";

describe("the brief's words", () => {
  it("names the free days the way a person says them, once each", () => {
    expect(daysInWords(["2026-10-22", "2026-10-24"], "fr")).toBe("jeudi et samedi");
    expect(daysInWords(["2026-10-22", "2026-10-24", "2026-10-29"], "en")).toBe("Thursday and Saturday");
    expect(daysInWords(["2026-10-19", "2026-10-20", "2026-10-21"], "en")).toBe("Monday, Tuesday and Wednesday");
  });
});

describe("the brief by e-mail", () => {
  it("says each card in one line, in the owner's language", async () => {
    const { briefLines } = await import("./brief");
    const base = { assumptions: [], evidence: [], urgency: "week" as const, impactCents: 0 };
    const items: ShopRecommendation[] = [
      { ...base, id: "2026-W43:gaps:ahead", kind: "gaps" as const, subject: "ahead", figures: { freeSlots: 5, missedCents: 45000, invitees: 14 }, action: { kind: "invite" as const, payload: { clientIds: [], days: [] } } },
      { ...base, id: "2026-W43:taxes:lastWeek", kind: "taxes" as const, subject: "lastWeek", figures: { setAsideCents: 54800, invoicedCents: 420000, availableCents: 365200 }, action: { kind: "taxes" as const, payload: { from: "", to: "" } } },
    ];
    // Intl writes a no-break space before « $ » in French: compared as plain spaces.
    const plain = (x: string | undefined) => (x ?? "").replace(/[\u00a0\u202f]/g, " ");
    const [gaps, taxes] = briefLines(items, {}, "fr").map(plain);
    expect(gaps).toBe("5 créneaux libres dans les 7 prochains jours (450,00 $ de manque à gagner) : 14 clients fidèles à inviter.");
    expect(taxes).toContain("548,00 $");
    expect(taxes).toContain("3 652,00 $");
    expect(plain(briefLines(items, {}, "en")[0])).toBe("5 free slots in the next 7 days ($450.00 of missed revenue): 14 regulars to invite.");
  });
});
