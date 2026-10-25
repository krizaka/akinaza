import { describe, expect, it } from "vitest";

import { accountMailTemplate } from "./account-access";

describe("the account block's mails in the outbox", () => {
  it("names a reset link « password-reset » and an address change « email-change »", () => {
    expect(accountMailTemplate("open this link:\nhttps://www.akinaza.com/fr/reset-password?token=ae1.x\n")).toBe("password-reset");
    expect(accountMailTemplate("open this link:\nhttps://www.akinaza.com/fr/confirm-email?token=ae1.x\n")).toBe("email-change");
  });
});
