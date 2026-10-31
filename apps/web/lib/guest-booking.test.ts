import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { codeRefusal, guestConfirm, guestStart } from "./guest-booking";

const ids = { serviceId: "5f0c2d3e-0a8b-4c55-9c1e-1d2f3a4b5c6d", zoneId: null, startsAt: "2026-11-02T15:00:00.000Z" };
const person = { fullName: " Camille Roy ", email: " Camille@Example.TEST ", phone: "514-555-0100" };

describe("a guest booking's two bodies", () => {
  it("cannot be sent without the booking consent, and never assumes the reminders", () => {
    expect(guestStart.safeParse({ ...ids, ...person, consentService: false }).success).toBe(false);
    const ok = guestStart.parse({ ...ids, ...person, consentService: true });
    expect(ok).toMatchObject({ fullName: "Camille Roy", email: "camille@example.test", consentReminders: false, language: "fr" });
  });

  it("takes exactly six digits for the code", () => {
    const base = { challengeId: "abcdefgh12345678", email: "a@example.test" };
    expect(guestConfirm.safeParse({ ...base, code: "123456" }).success).toBe(true);
    for (const code of ["12345", "1234567", "12345a", ""]) {
      expect(guestConfirm.safeParse({ ...base, code }).success).toBe(false);
    }
  });

  it("says why a code was refused, with the tries left", () => {
    expect(codeRefusal({ ok: false, reason: "invalid", attemptsLeft: 3 })).toEqual({ status: 400, code: "CODE_INVALID", attemptsLeft: 3 });
    expect(codeRefusal({ ok: false, reason: "locked" })).toEqual({ status: 429, code: "CODE_LOCKED" });
    expect(codeRefusal({ ok: false, reason: "expired" }).code).toBe("CODE_EXPIRED");
    expect(codeRefusal({ ok: false, reason: "unknown" }).status).toBe(410);
  });
});

describe("the last step of the booking path", () => {
  const page = readFileSync(new URL("../app/[locale]/s/[slug]/service/[id]/confirm/page.tsx", import.meta.url), "utf8");

  it("no longer sends a visitor to the owner sign-in: it shows the guest step, and sends back to the times when none was chosen", () => {
    expect(page).not.toMatch(/redirect\(`\/\$\{locale\}\/sign-in/);
    expect(page).toContain("guestView(");
    expect(page).toContain("redirect(timesHref(");
  });
});
