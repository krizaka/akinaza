import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { may } from "./shop-permissions";

describe("the permission of a role, readable by the client (ShopFrame imports app-nav, which needs it)", () => {
  it("answers from the roles table: the owner settles everything, staff sees no invoices", () => {
    expect(may("owner", "settings")).toBe(true);
    expect(may("manager", "settings")).toBe(false);
    expect(may("staff", "invoices")).toBe(false);
    expect(may("staff", "agenda")).toBe(true);
  });

  it("is not read from the server-only member module: no next/headers, no database in a client's graph", () => {
    const nav = readFileSync(new URL("./app-nav.ts", import.meta.url), "utf8");
    expect(nav).not.toMatch(/from "\.\/member-shop"/);
    const perms = readFileSync(new URL("./shop-permissions.ts", import.meta.url), "utf8");
    expect(perms).not.toMatch(/next\/headers|\.\/db"|member-shop/);
  });
});
