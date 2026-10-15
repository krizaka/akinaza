import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, appointments, invoices } from "./schema";
import { seedDemoShop } from "./seed";
import { prepareShopReturn } from "./shop-ops";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("the demo shop (real PostgreSQL 16)", () => {
  it("seeds a day of appointments and a balanced invoice through the real code, once per account", async () => {
    await t.db.insert(accounts).values({ email: "qa@example.test" });
    const now = new Date("2026-10-15T15:00:00Z");
    const first = await seedDemoShop(t.db, "QA@example.test", now);
    expect(first.created).toBe(true);
    expect(await t.db.select().from(appointments)).toHaveLength(4);
    const [invoice] = await t.db.select().from(invoices);
    expect(invoice).toMatchObject({ number: "F-00001", subtotalCents: 14_000, gstCents: 700, qstCents: 1_397, totalCents: 16_097 });
    const r = await prepareShopReturn(t.db, first.shopId, "2026-10-01", "2026-10-31");
    expect(r.gstNetCents).toBe(700 - 1_200);
    const [{ n } = { n: -1 }] = (await t.db.execute(sql`SELECT count(*)::int AS n FROM tax_ledger`)).rows as { n: number }[];
    expect(n).toBe(4);
    expect(await seedDemoShop(t.db, "qa@example.test", now)).toEqual({ shopId: first.shopId, created: false });
  });
});
