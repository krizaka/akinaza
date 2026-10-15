import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The pool's settings from a URL. TLS to the cluster is verified against its CA — never `rejectUnauthorized: false`;
 * the URL's `sslmode` is read here, not by the driver, so the rule lives in one place.
 */
export function poolConfig(url: string, caCert?: string, max = 5): pg.PoolConfig {
  const parsed = new URL(url);
  const mode = parsed.searchParams.get("sslmode");
  parsed.searchParams.delete("sslmode");
  const tls = mode === "require" || mode === "verify-ca" || mode === "verify-full";
  return { connectionString: parsed.toString(), max, idleTimeoutMillis: 30_000, ...(tls ? { ssl: { ca: caCert?.replace(/\\n/g, "\n"), rejectUnauthorized: true } } : {}) };
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}

export { pg };
