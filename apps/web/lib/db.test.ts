import { describe, expect, it } from "vitest";

import { poolConfig } from "./db";

describe("the pool", () => {
  it("verifies TLS against the cluster's CA, never blindly", () => {
    const config = poolConfig({ DATABASE_URL: "postgresql://u:p@db.example:25060/akinaza_db?sslmode=require", DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nX" });
    expect(config.ssl).toEqual({ ca: "-----BEGIN CERTIFICATE-----\nX", rejectUnauthorized: true });
    expect(config.connectionString).not.toContain("sslmode");
    expect(poolConfig({ DATABASE_URL: "postgresql://u:p@localhost:5432/akinaza_db" }).ssl).toBeUndefined();
  });

  it("refuses to start without a URL", () => {
    expect(() => poolConfig({})).toThrow(/DATABASE_URL/);
  });
});
