import { describe, expect, it } from "vitest";

import { changePassword, isResetToken, newResetToken, resetPassword, resetTokenHash } from "./password-reset";

const headers = new Headers();

describe("reset links", () => {
  it("makes a 256-bit token of a fixed shape, and recognises only that shape", () => {
    const token = newResetToken();
    expect(isResetToken(token)).toBe(true);
    expect(newResetToken()).not.toBe(token);
    expect(isResetToken("ar1.short")).toBe(false);
    expect(isResetToken(`as1.${token.slice(4)}`)).toBe(false);
    expect(isResetToken(undefined)).toBe(false);
  });

  it("keeps only a deterministic hash of the token, never the token", () => {
    const token = newResetToken();
    expect(resetTokenHash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(resetTokenHash(token)).toBe(resetTokenHash(token));
    expect(resetTokenHash(token)).not.toContain(token);
  });

  it("refuses a weak password and a malformed link before touching the database", async () => {
    await expect(resetPassword(newResetToken(), "short", headers)).rejects.toMatchObject({ status: 400, body: { code: "PASSWORD_TOO_SHORT" } });
    await expect(resetPassword("not-a-token", "a long enough password", headers)).rejects.toMatchObject({ status: 400, body: { code: "INVALID_TOKEN" } });
  });

  it("refuses a weak new password when changing while signed in", async () => {
    await expect(changePassword({ accountId: "x", sessionId: "y", email: "a@b.ca" }, "current", "short", headers)).rejects.toMatchObject({ body: { code: "PASSWORD_TOO_SHORT" } });
  });
});
