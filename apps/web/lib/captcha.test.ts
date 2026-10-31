import { describe, expect, it } from "vitest";

import { captchaConfigured, captchaMissing, isTurnstileTestKey, verifyCaptcha } from "./captcha";

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

  it("refuses Cloudflare's test keys in production, accepts them elsewhere (the CI journeys)", async () => {
    const test = { ABUSE_CAPTCHA_PROVIDER: "turnstile", ABUSE_CAPTCHA_SECRET_KEY: "1x0000000000000000000000000000000AA" };
    const prod = { ...test, NODE_ENV: "production", APP_ENVIRONMENT: "prod" };
    expect(isTurnstileTestKey(test.ABUSE_CAPTCHA_SECRET_KEY)).toBe(true);
    expect(isTurnstileTestKey("0x4AAAAAAAreal")).toBe(false);
    expect(captchaConfigured({ ...test, NODE_ENV: "production", APP_ENVIRONMENT: "dev" })).toBe(true);
    expect(captchaConfigured(prod)).toBe(false);
    expect(captchaMissing(prod)).toBe(true);
    expect(await verifyCaptcha("t", "1.2.3.4", prod, now, answer(true))).toBe(false);
    expect(captchaConfigured({ ...prod, ABUSE_CAPTCHA_SECRET_KEY: "0x4AAAAAAAreal" })).toBe(true);
  });
});
