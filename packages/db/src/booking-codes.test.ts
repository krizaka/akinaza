import { createEmailVerification } from "@krizaka/email-verification";
import { codeStoreContract } from "@krizaka/email-verification/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbCodeStore } from "./booking-codes";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

// The shared contract of every CodeStore adapter, against a real PostgreSQL 16.
codeStoreContract("the PostgreSQL store of booking codes", async () => {
  await t.pool.query("TRUNCATE booking_codes");
  return dbCodeStore(t.db);
});

describe("a visitor's pending booking (real PostgreSQL 16)", () => {
  const secret = "s".repeat(40);
  const at = new Date("2026-10-30T15:00:00Z");

  it("is released once for the right code and address, from another instance's store handle", async () => {
    const issuing = createEmailVerification({ store: dbCodeStore(t.db), secret, now: () => at });
    const confirming = createEmailVerification({ store: dbCodeStore(t.db), secret, now: () => at });
    const issued = await issuing.issue({ address: "visitor@example.test", payload: { serviceId: "s" } });
    const wrongAddress = await confirming.confirm({ challengeId: issued.challengeId, address: "someone@example.test", code: issued.code });
    expect(wrongAddress.ok).toBe(false);
    const ok = await confirming.confirm<{ serviceId: string }>({ challengeId: issued.challengeId, address: "visitor@example.test", code: issued.code });
    expect(ok).toEqual({ ok: true, payload: { serviceId: "s" } });
    expect(await confirming.confirm({ challengeId: issued.challengeId, address: "visitor@example.test", code: issued.code })).toMatchObject({ ok: false, reason: "unknown" });
  });

  it("never keeps the code, and the purge drops what expired", async () => {
    const verification = createEmailVerification({ store: dbCodeStore(t.db), secret, now: () => at });
    const issued = await verification.issue({ address: "gone@example.test", payload: {} });
    const rows = await t.pool.query("SELECT proof, payload FROM booking_codes WHERE id = $1", [issued.challengeId]);
    expect(JSON.stringify(rows.rows)).not.toContain(issued.code);
    const later = createEmailVerification({ store: dbCodeStore(t.db), secret, now: () => new Date(at.getTime() + 20 * 60_000) });
    expect(await later.purge()).toBeGreaterThanOrEqual(1);
    expect((await t.pool.query("SELECT 1 FROM booking_codes WHERE id = $1", [issued.challengeId])).rowCount).toBe(0);
  });
});
