import { randomUUID } from "node:crypto";

import { addLocalDays, localDay } from "@akinaza/core";
import { addTimeOff, addWindow, listSlots, offOn, removeTimeOff, ShopError, teamTimeOff } from "@akinaza/db";
import { seedDemoShop } from "@akinaza/db/seed";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, migrate, pool, query } from "./db";

/** Team time off as ranges (akinaza#208), on a real PostgreSQL (CI's service; locally `DATABASE_IT=1 DATABASE_URL=… pnpm test`). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("team time off", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const now = new Date();
  let shopId: string;
  let julie: string;
  let marc: string;
  let serviceId: string;
  let tz: string;
  // A week ahead, so the slots of those days are not cut by the booking notice.
  let first: string;
  const day = (offset: number) => addLocalDays(first, offset);

  beforeAll(async () => {
    await migrate();
    await query("INSERT INTO accounts (email, role, password_hash) VALUES ($1, 'USER', 'x')", [`timeoff-${stamp}@akinaza.test`]);
    ({ shopId } = await seedDemoShop(db(), `timeoff-${stamp}@akinaza.test`, now));
    const people = await query<{ id: string; name: string }>("SELECT id, name FROM staff WHERE shop_id = $1", [shopId]);
    julie = people.find((p) => p.name === "Julie")!.id;
    marc = people.find((p) => p.name === "Marc")!.id;
    serviceId = (await query<{ id: string }>("SELECT id FROM services WHERE shop_id = $1 ORDER BY duration_minutes LIMIT 1", [shopId]))[0]!.id;
    tz = (await query<{ timezone: string }>("SELECT timezone FROM shops WHERE id = $1", [shopId]))[0]!.timezone;
    first = addLocalDays(localDay(now, tz), 7);
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) await addWindow(db(), shopId, { weekday, startsAt: "09:00", endsAt: "17:00" }, julie).catch(() => undefined);
  });
  // The shop stays, like every suite's: its ledger rows (the seeded invoice and expense) are kept by design.
  afterAll(async () => {
    await pool().end();
  });

  const julieDays = async () => new Set((await listSlots(db(), { shopId, serviceId, zoneId: null, now, staffId: julie, fromDay: first, days: 5 })).map((s) => localDay(s.startsAt, tz)));

  it("a range keeps the person's slots off those days, and only those days", async () => {
    expect((await julieDays()).has(day(1))).toBe(true);
    await addTimeOff(db(), shopId, julie, { from: day(1), to: day(2) }, "Vacances");
    const open = await julieDays();
    expect(open.has(day(0))).toBe(true);
    expect(open.has(day(1)) || open.has(day(2))).toBe(false);
    expect(open.has(day(3))).toBe(true);
  });

  it("an overlapping range joins the first; removing a part splits it; Today says who is off and until when", async () => {
    await addTimeOff(db(), shopId, julie, { from: day(2), to: day(4) });
    await addTimeOff(db(), shopId, marc, { from: day(3), to: day(3) });
    expect(await teamTimeOff(db(), shopId, first)).toEqual([
      { staffId: julie, name: "Julie", from: day(1), to: day(4), reason: "Vacances" },
      { staffId: marc, name: "Marc", from: day(3), to: day(3), reason: null },
    ]);
    expect(await offOn(db(), shopId, day(3))).toEqual(expect.arrayContaining([{ staffId: julie, name: "Julie", until: day(4) }, { staffId: marc, name: "Marc", until: day(3) }]));
    await removeTimeOff(db(), shopId, julie, { from: day(2), to: day(3) });
    expect((await teamTimeOff(db(), shopId, first)).filter((t) => t.staffId === julie).map((t) => [t.from, t.to])).toEqual([
      [day(1), day(1)],
      [day(4), day(4)],
    ]);
  });

  it("a reversed range, a range too long, or someone of another shop are refused", async () => {
    await expect(addTimeOff(db(), shopId, julie, { from: day(4), to: day(1) })).rejects.toMatchObject({ code: "AK_TIME_OFF_ORDER" });
    await expect(addTimeOff(db(), shopId, julie, { from: day(0), to: addLocalDays(first, 200) })).rejects.toMatchObject({ code: "AK_TIME_OFF_TOO_LONG" });
    await expect(addTimeOff(db(), shopId, randomUUID(), { from: day(0), to: day(0) })).rejects.toBeInstanceOf(ShopError);
  });
});
