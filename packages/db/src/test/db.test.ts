import { describe, expect, it } from "vitest";

import type { pg } from "../client";
import { endPool, freshEmptyDatabase } from "./db";

/** A pooled client and the socket it reads from. */
type Socketed = pg.PoolClient & { connection: { stream: { destroyed: boolean } } };

/**
 * The harness itself. `pool.end()` resolves as soon as every client is *asked* to end, not when its socket is closed;
 * a `DROP DATABASE … WITH (FORCE)` right after then kills a backend that has not yet closed, the client reads
 * « terminating connection due to administrator command » (57P01) while idle, and the pool raises an uncaught error
 * (the flake of Verify (test)). The pool must be really closed before the database is dropped.
 */
describe("test database teardown", () => {
  it("endPool resolves only once every connection of the pool is closed", async () => {
    const { pool, drop } = await freshEmptyDatabase();
    const seen: Socketed[] = [];
    pool.on("connect", (client) => seen.push(client as Socketed));
    await Promise.all([1, 2, 3, 4].map(() => pool.query("select 1")));
    expect(seen).toHaveLength(4);
    await endPool(pool);
    expect(seen.every((client) => client.connection.stream.destroyed)).toBe(true);
  });
});
