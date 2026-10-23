import { randomUUID } from "node:crypto";

import { seedDemoShop } from "@akinaza/db/seed";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db, migrate, pool, query } from "./db";

let signedIn = "";
vi.mock("./access", () => ({ pageSession: async () => ({ id: "s", account: { id: signedIn } }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { memberOf, memberShop } = await import("./member-shop");

/** The shop named by the address, against a real PostgreSQL (CI's service; locally `DATABASE_IT=1 DATABASE_URL=… pnpm test`). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("the shop of the address", () => {
  // Unique across test files run in parallel: two files starting in the same millisecond collided on accounts_email_unique.
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  let owner: string;
  let outsider: string;
  let ownShop: string;
  let otherShop: string;

  beforeAll(async () => {
    await migrate();
    const make = async (email: string) => (await query<{ id: string }>("INSERT INTO accounts (email, role, password_hash) VALUES ($1, 'USER', 'x') RETURNING id", [email]))[0]!.id;
    owner = await make(`own-${stamp}@akinaza.test`);
    outsider = await make(`out-${stamp}@akinaza.test`);
    const other = await make(`oth-${stamp}@akinaza.test`);
    await seedDemoShop(db(), `own-${stamp}@akinaza.test`);
    await seedDemoShop(db(), `oth-${stamp}@akinaza.test`);
    ownShop = (await query<{ id: string }>("SELECT scope_id AS id FROM memberships WHERE account_id = $1", [owner]))[0]!.id;
    otherShop = (await query<{ id: string }>("SELECT scope_id AS id FROM memberships WHERE account_id = $1", [other]))[0]!.id;
    // The owner of the first shop also works in the second, as staff.
    await query("INSERT INTO memberships (scope_id, account_id, role, created_at) VALUES ($1, $2, 'staff', now())", [otherShop, owner]);
  });
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE email LIKE $1", [`%-${stamp}@akinaza.test`]);
    await pool().end();
  });

  it("opens a deep link to another shop the person belongs to, with their role there", async () => {
    signedIn = owner;
    expect((await memberShop(otherShop, "agenda")).role).toBe("staff");
    expect((await memberShop(ownShop, "team")).role).toBe("owner");
  });

  it("answers 404 for a shop the person does not belong to, and for a permission their role there lacks", async () => {
    signedIn = outsider;
    await expect(memberShop(ownShop, "agenda")).rejects.toThrow("NOT_FOUND");
    signedIn = owner;
    await expect(memberShop(otherShop, "invoices")).rejects.toThrow("NOT_FOUND");
  });

  it("reads anything that is not a shop id as no membership, without asking the database", async () => {
    expect(await memberOf(owner, "clients")).toBeNull();
    expect(await memberOf(owner, "profile")).toBeNull();
  });
});
