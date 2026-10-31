import type { Challenge, CodeStore } from "@krizaka/email-verification";
import { eq, lt, sql } from "drizzle-orm";

import type { Db } from "./client";
import { bookingCodes } from "./schema";

/**
 * Where a visitor's pending booking waits for its code (`@krizaka/email-verification`'s `CodeStore`), in PostgreSQL so that any instance
 * can confirm what another one issued. The attempts counter and the single use are atomic statements (`UPDATE … RETURNING`, `DELETE … RETURNING`).
 */
export function dbCodeStore(db: Db): CodeStore {
  return {
    async put(challenge: Challenge) {
      await db.insert(bookingCodes).values({ id: challenge.id, proof: challenge.proof, attempts: challenge.attempts, expiresAt: challenge.expiresAt, payload: challenge.payload });
    },
    async get(id: string) {
      const [row] = await db.select().from(bookingCodes).where(eq(bookingCodes.id, id));
      return row ? { id: row.id, proof: row.proof, attempts: row.attempts, expiresAt: row.expiresAt, payload: row.payload } : null;
    },
    async recordFailure(id: string) {
      const [row] = await db.update(bookingCodes).set({ attempts: sql`${bookingCodes.attempts} + 1` }).where(eq(bookingCodes.id, id)).returning({ attempts: bookingCodes.attempts });
      return row?.attempts ?? null;
    },
    async consume(id: string) {
      const rows = await db.delete(bookingCodes).where(eq(bookingCodes.id, id)).returning({ id: bookingCodes.id });
      return rows.length > 0;
    },
    async purge(now: Date) {
      const rows = await db.delete(bookingCodes).where(lt(bookingCodes.expiresAt, now)).returning({ id: bookingCodes.id });
      return rows.length;
    },
  };
}
