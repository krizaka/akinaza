import { describe, expect, it } from "vitest";

import { assertProductionEnv, consoleAllowedIps, productionProblems, readEnv } from "./env";

const PROD = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://akinaza_db:x@db.example:25060/akinaza_db?sslmode=require",
  DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----",
  AUTH_SESSION_SECRET: "a".repeat(40),
  AI_API_KEY: "oz_live_key",
};

describe("env", () => {
  it("closes sign-up unless AUTH_SIGNUP_ENABLED is exactly true", () => {
    expect(readEnv({}).AUTH_SIGNUP_ENABLED).toBe(false);
    expect(readEnv({ AUTH_SIGNUP_ENABLED: "yes" }).AUTH_SIGNUP_ENABLED).toBe(false);
    expect(readEnv({ AUTH_SIGNUP_ENABLED: "TRUE" }).AUTH_SIGNUP_ENABLED).toBe(true);
  });

  it("runs the tax assistant on Orazaka only", () => {
    expect(readEnv({}).AI_PROVIDER).toBe("orazaka");
    expect(() => readEnv({ AI_PROVIDER: "openai" })).toThrow();
    expect(readEnv({}).AI_API_URL).toBe("https://dev.orazaka.com/edge");
  });

  it("refuses a production start without its secrets, naming them, never showing them", () => {
    expect(() => assertProductionEnv(PROD)).not.toThrow();
    const problems = productionProblems(readEnv({ NODE_ENV: "production", AI_API_KEY: "sk-not-orazaka", DATABASE_URL: PROD.DATABASE_URL }));
    expect(problems).toEqual([
      "AUTH_SESSION_SECRET must be at least 32 characters",
      "AI_API_KEY must be an Orazaka key (oz_…)",
      "DATABASE_CA_CERT is required for a TLS database",
    ]);
    expect(problems.join(" ")).not.toContain("sk-not-orazaka");
    expect(productionProblems(readEnv({}))).toEqual([]);
  });

  it("keeps the point of sale off unless its flag is exactly true", () => {
    expect(readEnv({}).APP_POS_ENABLED).toBe(false);
    expect(readEnv({ APP_POS_ENABLED: "true" }).APP_POS_ENABLED).toBe(true);
  });

  it("starts without an Orazaka key (the feed is off) but never with a foreign one", () => {
    const withoutKey: Record<string, string | undefined> = { ...PROD, AI_API_KEY: undefined };
    expect(() => assertProductionEnv(withoutKey)).not.toThrow();
    expect(() => assertProductionEnv({ ...PROD, AI_API_KEY: "sk-other" })).toThrow(/AI_API_KEY/);
  });

  it("bounds the pool and closes search engines only by an exact off", () => {
    expect(readEnv({}).DATABASE_MAX_CONNECTIONS).toBe(5);
    expect(readEnv({ DATABASE_MAX_CONNECTIONS: "2" }).DATABASE_MAX_CONNECTIONS).toBe(2);
    expect(() => readEnv({ DATABASE_MAX_CONNECTIONS: "500" })).toThrow();
    expect(readEnv({}).APP_SEARCH_INDEXING).toBe("on");
    expect(readEnv({ APP_SEARCH_INDEXING: "off" }).APP_SEARCH_INDEXING).toBe("off");
  });

  it("lets nobody into the administration in production without an allow-list", () => {
    expect(consoleAllowedIps({ NODE_ENV: "production" })).toEqual([]);
    expect(consoleAllowedIps({ NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7, 198.51.100.2" })).toEqual(["203.0.113.7", "198.51.100.2"]);
    expect(consoleAllowedIps({ NODE_ENV: "development" })).toBeNull();
  });
});
