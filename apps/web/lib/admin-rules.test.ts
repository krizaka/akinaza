import { describe, expect, it } from "vitest";

import { hostAllowed } from "./access";
import { roleChangeRefusal } from "./admin";
import { ledgerAgrees } from "./admin-content";
import { budgetLimit, budgetShare } from "./operations-shared";

describe("who may change a role", () => {
  it("never your own", () => {
    expect(roleChangeRefusal("a", "a", "USER", 3, "ADMIN")).toMatchObject({ code: "SELF_ROLE" });
  });
  it("never withdraws the last administrator", () => {
    expect(roleChangeRefusal("a", "b", "USER", 1, "ADMIN")).toMatchObject({ code: "LAST_ADMIN" });
  });
  it("lets an administrator withdraw another while one remains, and grant the role", () => {
    expect(roleChangeRefusal("a", "b", "USER", 2, "ADMIN")).toBeNull();
    expect(roleChangeRefusal("a", "b", "ADMIN", 1, "USER")).toBeNull();
  });
});

describe("the ledger check", () => {
  it("agrees only when both taxes equal what the invoice says", () => {
    expect(ledgerAgrees({ gstCents: 700, qstCents: 1397 }, { gstCents: 700, qstCents: 1397 })).toBe(true);
    expect(ledgerAgrees({ gstCents: 700, qstCents: 1397 }, { gstCents: 700, qstCents: 1396 })).toBe(false);
    expect(ledgerAgrees({ gstCents: 0, qstCents: 0 }, { gstCents: 0, qstCents: 0 })).toBe(true);
  });
  it("handles a credit note: its negative taxes against its negative entries", () => {
    expect(ledgerAgrees({ gstCents: -700, qstCents: -1397 }, { gstCents: -700, qstCents: -1397 })).toBe(true);
  });
});

describe("the database budget", () => {
  it("is the role's own limit when it has one, else the server's", () => {
    expect(budgetLimit(22, 100)).toBe(22);
    expect(budgetLimit(-1, 100)).toBe(100);
    expect(budgetLimit(500, 100)).toBe(100);
  });
  it("shares what is used, capped, 0 without a budget", () => {
    expect(budgetShare(5, 20)).toBe(0.25);
    expect(budgetShare(30, 20)).toBe(1);
    expect(budgetShare(3, 0)).toBe(0);
  });
});

describe("the administration host", () => {
  const env = { NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7", ABUSE_CLIENT_IP_HEADER: "do-connecting-ip" };
  const call = (host: string, ip: string) => new Headers({ host, "do-connecting-ip": ip });
  it("refuses a foreign address everywhere on admin.akinaza.com, the sign-in included", () => {
    expect(hostAllowed(call("admin.akinaza.com", "198.51.100.9"), env)).toBe(false);
    expect(hostAllowed(call("admin.akinaza.com", "203.0.113.7"), env)).toBe(true);
  });
  it("leaves the product host open", () => {
    expect(hostAllowed(call("dev.akinaza.com", "198.51.100.9"), env)).toBe(true);
  });
});
