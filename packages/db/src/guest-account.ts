import { eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { accounts } from "./schema";

/** The only account a booking page's code may open: an ordinary, active one. */
const OPEN = { role: "USER", status: "ACTIVE" } as const;

export type GuestAccount = { ok: true; id: string; email: string; locale: "en" | "fr" } | { ok: false; reason: "sign-in-required" };

/**
 * The account of a visitor who proved their address by the code mailed to it (krizaka-internal#1909): found, or made without a password
 * (the address is verified by that very act). An account that can sign in (a password), is an administrator or is suspended is never opened
 * by a code from a booking page: that person signs in. Safe to call twice at once (the address is unique).
 */
export async function guestAccountFor(db: Db, input: { email: string; locale: "en" | "fr"; name: string }, now: Date): Promise<GuestAccount> {
  const email = input.email.trim().toLowerCase();
  await db.insert(accounts).values({ email, role: OPEN.role, locale: input.locale, name: input.name, emailVerifiedAt: now }).onConflictDoNothing({ target: accounts.email });
  const [row] = await db.select().from(accounts).where(eq(accounts.email, email));
  if (!row || row.role !== OPEN.role || row.status !== OPEN.status || row.passwordHash !== null) return { ok: false, reason: "sign-in-required" };
  await db.update(accounts).set({ emailVerifiedAt: sql`coalesce(${accounts.emailVerifiedAt}, ${now.toISOString()}::timestamptz)`, lastSeenAt: now }).where(eq(accounts.id, row.id));
  return { ok: true, id: row.id, email: row.email, locale: row.locale };
}
