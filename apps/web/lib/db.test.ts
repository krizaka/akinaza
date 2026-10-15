import { describe, expect, it } from "vitest";

import { migrationPoolConfig, poolConfig } from "./db";

describe("the pool", () => {
  it("verifies TLS against the cluster's CA, never blindly", () => {
    const config = poolConfig({ DATABASE_URL: "postgresql://u:p@db.example:25060/akinaza_db?sslmode=require", DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nX" });
    expect(config.ssl).toEqual({ ca: "-----BEGIN CERTIFICATE-----\nX", rejectUnauthorized: true });
    expect(config.connectionString).not.toContain("sslmode");
    expect(poolConfig({ DATABASE_URL: "postgresql://u:p@localhost:5432/akinaza_db" }).ssl).toBeUndefined();
  });

  it("caps the pool by DATABASE_MAX_CONNECTIONS", () => {
    expect(poolConfig({ DATABASE_URL: "postgresql://u:p@localhost:5432/x" }).max).toBe(5);
    expect(poolConfig({ DATABASE_URL: "postgresql://u:p@localhost:5432/x", DATABASE_MAX_CONNECTIONS: "2" }).max).toBe(2);
  });

  it("migrates on one direct connection, never through the transaction pooler", () => {
    const config = migrationPoolConfig({ DATABASE_URL: "postgresql://u:p@pool.example:25061/pool-x", DATABASE_DIRECT_URL: "postgresql://u:p@db.example:25060/x" });
    expect(config.max).toBe(2);
    expect(config.connectionString).toContain("db.example:25060");
    expect(migrationPoolConfig({ DATABASE_URL: "postgresql://u:p@pool.example:25061/x" }).connectionString).toContain("pool.example");
  });

  it("refuses to start without a URL", () => {
    expect(() => poolConfig({})).toThrow(/DATABASE_URL/);
  });
});
