import { describe, expect, it } from "vitest";

import { migrationPoolConfig, poolConfig, transactionOn } from "./db";

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

describe("one transaction", () => {
  const fake = (fail: { at?: string } = {}) => {
    const said: string[] = [];
    let released = 0;
    const client = {
      query: async (text: string) => {
        said.push(text);
        if (text === fail.at) throw new Error(`${text} failed`);
        return { rows: [{ text }] };
      },
      release: () => void released++,
    };
    return { said, released: () => released, pool: { connect: async () => client } };
  };

  it("commits what the work did, on one connection given back after", async () => {
    const f = fake();
    expect(await transactionOn(f.pool, async (run) => (await run("SELECT 1"))[0])).toEqual({ text: "SELECT 1" });
    expect(f.said).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    expect(f.released()).toBe(1);
  });

  it("rolls back when the work throws, and rethrows that very error", async () => {
    const f = fake();
    const boom = new Error("boom");
    await expect(transactionOn(f.pool, async () => Promise.reject(boom))).rejects.toBe(boom);
    expect(f.said).toEqual(["BEGIN", "ROLLBACK"]);
    expect(f.released()).toBe(1);
  });

  it("never lets a failed ROLLBACK hide why the work failed: the original error comes first", async () => {
    const f = fake({ at: "ROLLBACK" });
    const boom = new Error("boom");
    const error = await transactionOn(f.pool, async () => Promise.reject(boom)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors[0]).toBe(boom);
    expect(f.released()).toBe(1);
  });
});
