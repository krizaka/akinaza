import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { sealField } from "./crypto";
import { GUARDED_DIGITS, leaksPlaintext } from "./plaintext-leak";

/** akinaza#358: random ciphertext, ids and hashes hold any short run of digits; only the plaintext itself is a leak. */
describe("the privacy check never reads digit runs in random bytes (akinaza#358)", () => {
  const secret = "Code 4821, clé sous le pot de lavande";

  it("passes a ciphertext that holds every guarded digit sequence", () => {
    const seeded = `v1.${GUARDED_DIGITS.join("")}.${GUARDED_DIGITS.join("_")}.${GUARDED_DIGITS.join("-")}`;
    expect(GUARDED_DIGITS).toContain("4821");
    expect(GUARDED_DIGITS).toContain("514");
    expect(leaksPlaintext(seeded, secret)).toBe(false);
    expect(leaksPlaintext(JSON.stringify({ id: `3f8a-${GUARDED_DIGITS.join("")}-cf2` }), secret)).toBe(false);
  });

  it("still catches the plaintext, whole or quoted in JSON", () => {
    expect(leaksPlaintext(`x ${secret} y`, secret)).toBe(true);
    expect(leaksPlaintext(JSON.stringify({ notes: secret }), secret)).toBe(true);
  });

  it("passes real ciphertexts, whatever their random bytes", () => {
    for (let i = 0; i < 200; i++) expect(leaksPlaintext(sealField(secret, randomBytes(32), "c"), secret)).toBe(false);
  });
});
