import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { priceCatalogue, priceStore } from "@krizaka/settings";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { associationApproved, associationProofOf, decideAssociation, pendingAssociations, submitAssociationProof } from "./association";
import { PRICE_SCHEDULE, PRICE_SCHEDULE_SQL, scheduledPrice } from "./price-schedule";
import { freshDatabase } from "./test/db";
import { account } from "./test/fixtures";

const NOW = new Date("2026-11-02T15:00:00Z");
let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("an association proves what it is, an administrator decides (real PostgreSQL 16)", () => {
  it("the whole flow: nothing, submitted (pending), approved; until then the account is not an association", async () => {
    const owner = await account(t.db, "oblique@example.test");
    const admin = await account(t.db, "admin-a@example.test");
    expect(await associationApproved(t.db, owner.id)).toBe(false);
    expect(await associationProofOf(t.db, owner.id)).toBeNull();
    const proof = await submitAssociationProof(t.db, owner.id, { kind: "neq", reference: "1234567890" });
    expect(await associationProofOf(t.db, owner.id)).toMatchObject({ id: proof, kind: "neq", reference: "1234567890", status: "pending" });
    expect(await associationApproved(t.db, owner.id)).toBe(false);
    expect((await pendingAssociations(t.db)).map((p) => p.id)).toContain(proof);
    expect(await decideAssociation(t.db, proof, admin.id, "approved", NOW)).toBe(true);
    expect(await associationApproved(t.db, owner.id)).toBe(true);
    expect((await pendingAssociations(t.db)).map((p) => p.id)).not.toContain(proof);
    // A decision is taken once.
    expect(await decideAssociation(t.db, proof, admin.id, "rejected", NOW)).toBe(false);
    expect(await associationApproved(t.db, owner.id)).toBe(true);
  });

  it("a refusal keeps the account on Starter and says why; the shop may submit again", async () => {
    const owner = await account(t.db, "refused@example.test");
    const admin = await account(t.db, "admin-b@example.test");
    const first = await submitAssociationProof(t.db, owner.id, { kind: "charity", reference: "123456789 RR 0001" });
    await decideAssociation(t.db, first, admin.id, "rejected", NOW, "Number not found in the register");
    expect(await associationApproved(t.db, owner.id)).toBe(false);
    expect(await associationProofOf(t.db, owner.id)).toMatchObject({ status: "rejected", reference: "123456789RR0001", decisionNote: "Number not found in the register" });
    const second = await submitAssociationProof(t.db, owner.id, { kind: "incorporation", reference: "Letters patent 1998-114" });
    expect(await associationProofOf(t.db, owner.id)).toMatchObject({ id: second, status: "pending" });
  });

  it("refuses a second pending proof, a malformed number, and a new proof once approved", async () => {
    const owner = await account(t.db, "twice@example.test");
    const admin = await account(t.db, "admin-c@example.test");
    const id = await submitAssociationProof(t.db, owner.id, { kind: "neq", reference: "1234567890" });
    await expect(submitAssociationProof(t.db, owner.id, { kind: "neq", reference: "1234567890" })).rejects.toMatchObject({ code: "AK_ASSOCIATION_PENDING" });
    await decideAssociation(t.db, id, admin.id, "approved", NOW);
    await expect(submitAssociationProof(t.db, owner.id, { kind: "neq", reference: "1234567890" })).rejects.toMatchObject({ code: "AK_ASSOCIATION_APPROVED" });
    const other = await account(t.db, "bad@example.test");
    await expect(submitAssociationProof(t.db, other.id, { kind: "neq", reference: "12345" })).rejects.toMatchObject({ code: "AK_ASSOCIATION_REFERENCE" });
    await expect(submitAssociationProof(t.db, other.id, { kind: "charity", reference: "nope" })).rejects.toMatchObject({ code: "AK_ASSOCIATION_REFERENCE" });
  });
});

describe("the new prices are a dated version of the catalogue, never a rewritten seed (migration, real PostgreSQL 16)", () => {
  const seed = {
    unit: "month", currency: "CAD", taxes: "plus-taxes", availability: "public", amountCents: 4500,
    limits: { cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 },
  } as const;

  it("Starter 29 $ with three free months, Pro 69 $, and the founder offer ends: each a version audited in settings_audit", async () => {
    const rows = (await t.db.execute(sql`SELECT key, price, before, actor_label FROM price_versions ORDER BY key`)).rows as { key: string; price: { amountCents: number; availability: string; limits: Record<string, number> }; before: { amountCents: number }; actor_label: string }[];
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by["akinaza.starter"]).toMatchObject({ price: { amountCents: 2900, limits: { trialDays: 90, directDebitBps: 50 } }, before: { amountCents: 4500 } });
    expect(by["akinaza.scale"]).toMatchObject({ price: { amountCents: 6900 }, before: { amountCents: 9900 } });
    expect(by["akinaza.founder"]).toMatchObject({ price: { availability: "internal", amountCents: 3900 } });
    const audit = (await t.db.execute(sql`SELECT key FROM settings_audit WHERE actor_label = ${PRICE_SCHEDULE[0]!.label} ORDER BY key`)).rows as { key: string }[];
    expect(audit.map((a) => a.key)).toEqual(["akinaza.founder", "akinaza.scale", "akinaza.starter"]);
  });

  it("grandfathering: the version a subscriber was sold at is still 45 $ (the seed) while a newcomer is offered 29 $", async () => {
    const prices = priceCatalogue(
      { keys: ["akinaza.starter"], isKey: (k) => k === "akinaza.starter", defaultOf: () => ({ ...seed, limits: { ...seed.limits } }) },
      priceStore({ query: async (text, params) => (await t.pool.query(text, params as unknown[])).rows as never }),
    );
    const now = new Date();
    const offered = await prices.entry("akinaza.starter", new Date(now.getTime() + 1000));
    expect(offered.amountCents).toBe(2900);
    const sold = await prices.version("seed:akinaza.starter");
    expect(sold?.amountCents).toBe(4500);
    expect(offered.versionId).not.toBe("seed:akinaza.starter");
  });

  it("scheduledPrice applies the schedule onto a seed (the processor's catalogue sells these amounts)", () => {
    expect(scheduledPrice("akinaza.starter", seed)).toMatchObject({ amountCents: 2900, limits: { trialDays: 90 } });
    expect(scheduledPrice("akinaza.other", seed)).toEqual(seed);
  });
});
