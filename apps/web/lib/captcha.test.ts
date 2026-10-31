import { describe, expect, it } from "vitest";

import { captchaConfigured, captchaMissing, verifyCaptcha } from "./captcha";

const now = () => new Date("2026-10-30T12:00:00Z");
const answer = (success: boolean) => async () => ({ ok: true, json: async () => ({ success }) });
const configured = { ABUSE_CAPTCHA_PROVIDER: "turnstile", ABUSE_CAPTCHA_SECRET_KEY: "test-key", NODE_ENV: "development" };

describe("the CAPTCHA of the public forms", () => {
  it("is off outside production when unconfigured, and a refusal in production", async () => {
    expect(captchaConfigured({})).toBe(false);
    expect(await verifyCaptcha(undefined, "1.2.3.4", { NODE_ENV: "development" }, now)).toBe(true);
    expect(captchaMissing({ NODE_ENV: "production" })).toBe(true);
    expect(await verifyCaptcha("token", "1.2.3.4", { NODE_ENV: "production" }, now)).toBe(false);
  });

  it("asks Cloudflare when configured: a missing token or a refusal fails, a good token passes", async () => {
    expect(await verifyCaptcha(undefined, "1.2.3.4", configured, now, answer(true))).toBe(false);
    expect(await verifyCaptcha("t", "1.2.3.4", configured, now, answer(false))).toBe(false);
    expect(await verifyCaptcha("t", "1.2.3.4", configured, now, answer(true))).toBe(true);
  });
});
