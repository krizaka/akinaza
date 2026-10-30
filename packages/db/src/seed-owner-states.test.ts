import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, clients, expenses, invoices, services } from "./schema";
import { OWNER_STATE_EMAILS, OWNER_STATES, seedOwnerStates } from "./seed-owner-states";
import { shopOfOwner } from "./service-shop";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
  await t.db.insert(accounts).values(OWNER_STATE_EMAILS.map((email) => ({ email, passwordHash: "x" })));
});
afterAll(async () => t.drop());

const NOW = new Date("2026-10-21T15:00:00Z");

describe("the owner states of the audit (#405)", () => {
  it("seeds an owner whose shop has nothing in it, and an owner whose shop has exactly one item per list", async () => {
    const { emptyShopId, oneShopId } = await seedOwnerStates(t.db, NOW);
    for (const table of [services, clients, invoices, expenses]) {
      expect((await t.db.select().from(table).where(eq(table.shopId, emptyShopId))).length, "empty").toBe(0);
      expect((await t.db.select().from(table).where(eq(table.shopId, oneShopId))).length, "one").toBe(1);
    }
    const [owner] = await t.db.select().from(accounts).where(eq(accounts.email, OWNER_STATES.empty.email));
    expect((await shopOfOwner(t.db, owner!.id))?.id).toBe(emptyShopId);
  });

  it("is idempotent: a second run adds nothing", async () => {
    await seedOwnerStates(t.db, NOW);
    const [row] = await t.db.select().from(invoices);
    expect(row).toBeDefined();
    expect(await t.db.select().from(invoices)).toHaveLength(1);
    expect(await t.db.select().from(services)).toHaveLength(1);
  });
});
