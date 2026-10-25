import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { founderGate, founderSeats } from "./billing";
import { migrate, pool, query } from "./db";

/** The founder offer's seats on a real PostgreSQL (CI's service; locally `DATABASE_IT=1 DATABASE_URL=… pnpm test`) — akinaza#363. */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("the founder offer's seats", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  let founder: string;
  let newcomer: string;

  const account = async (tag: string) =>
    (await query<{ id: string }>("INSERT INTO accounts (email, role, password_hash) VALUES ($1, 'USER', 'x') RETURNING id", [`seat-${tag}-${stamp}@akinaza.test`]))[0]!.id;

  beforeAll(async () => {
    await migrate();
    founder = await account("a");
    newcomer = await account("b");
  });
  afterAll(async () => {
    await pool().end();
  });

  it("counts a business from its first subscription, closes at the limit and never turns a founder away", async () => {
    const before = (await founderSeats(query, 1000)).taken;
    await query("UPDATE accounts SET payment_subscription_id = $2 WHERE id = $1", [founder, `sub_${stamp}`]);
    const after = await founderSeats(query, before + 1);
    expect(after).toEqual({ limit: before + 1, taken: before + 1, open: false });
    expect(await founderGate(query, newcomer, before + 1)).toBe("full");
    expect(await founderGate(query, newcomer, before + 2)).toBe("open");
    expect(await founderGate(query, founder, 1)).toBe("member");
  });
});
