import { seedDemoShop } from "@akinaza/db/seed";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditLog, deleteAccount, exportAccount, listUsers, revokeUserSessions, setUserRole, setUserStatus, userDetail } from "./admin";
import { invoicesOverview, ledgerChecks, shopsOverview } from "./admin-content";
import { db, migrate, pool, query } from "./db";
import { operations } from "./operations";
import { createSession } from "./session";

/** The administration against a real PostgreSQL (CI's service; locally `DATABASE_IT=1 DATABASE_URL=… pnpm test`). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("administration", () => {
  const stamp = Date.now();
  let admin: { id: string; email: string };
  let merchant: { id: string; email: string };
  let plain: { id: string; email: string };

  beforeAll(async () => {
    await migrate();
    const make = async (email: string, role: string) => (await query<{ id: string }>("INSERT INTO accounts (email, role, password_hash) VALUES ($1, $2, 'x') RETURNING id", [email, role]))[0]!.id;
    admin = { id: await make(`adm-${stamp}@akinaza.test`, "ADMIN"), email: `adm-${stamp}@akinaza.test` };
    merchant = { id: await make(`mer-${stamp}@akinaza.test`, "USER"), email: `mer-${stamp}@akinaza.test` };
    plain = { id: await make(`pla-${stamp}@akinaza.test`, "USER"), email: `pla-${stamp}@akinaza.test` };
    await seedDemoShop(db(), merchant.email);
  });
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE id = ANY($1)", [[admin.id, plain.id]]);
    await pool().end();
  });

  it("lists the accounts with the shops they own, and one account's detail", async () => {
    expect((await listUsers()).find((u) => u.id === merchant.id)).toMatchObject({ role: "USER", status: "ACTIVE", shops: 1 });
    expect(await userDetail(merchant.id)).toMatchObject({ email: merchant.email, sessions: 0 });
  });

  it("reads the shops, the invoices with their ledger check, and the monthly ledger checks", async () => {
    const shop = (await shopsOverview()).find((s) => s.owner === merchant.email);
    expect(shop).toMatchObject({ name: "Salon Laurier", registrant: true, invoices: 1 });
    const invoices = (await invoicesOverview()).filter((i) => i.shop === "Salon Laurier");
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices.every((i) => i.ledgerOk && i.totalCents === i.subtotalCents + i.gstCents + i.qstCents)).toBe(true);
    const months = (await ledgerChecks()).filter((c) => c.shop === "Salon Laurier");
    expect(months.length).toBeGreaterThanOrEqual(1);
    expect(months.every((c) => c.ok)).toBe(true);
  });

  it("reads the operations figures: the ledger agrees with the invoices", async () => {
    const ops = await operations();
    expect(ops.connections.open).toBeGreaterThan(0);
    expect(ops.invoiceMismatches).toBe(0);
    expect(ops.monthMismatches).toBe(0);
  });

  it("suspends, restores, grants and withdraws the role, ends sessions — never on yourself", async () => {
    await createSession(plain.id, { ip: "203.0.113.7", userAgent: "vitest" });
    expect((await setUserStatus(admin, plain.id, "SUSPENDED")).sessions).toBe(0);
    expect((await setUserStatus(admin, plain.id, "ACTIVE")).status).toBe("ACTIVE");
    await expect(setUserStatus(admin, admin.id, "SUSPENDED")).rejects.toMatchObject({ status: 409 });
    await expect(setUserRole(admin, admin.id, "USER")).rejects.toMatchObject({ status: 409 });
    expect((await setUserRole(admin, plain.id, "ADMIN")).role).toBe("ADMIN");
    expect((await setUserRole(admin, plain.id, "USER")).role).toBe("USER");
    await createSession(plain.id, { ip: "203.0.113.8", userAgent: "vitest" });
    expect((await revokeUserSessions(admin, plain.id)).revoked).toBe(1);
    expect((await auditLog(20, plain.id)).map((e) => e.action)).toEqual(expect.arrayContaining(["admin.user_suspended", "admin.user_restored", "admin.user_role_changed", "admin.sessions_revoked"]));
  });

  it("exports an account with its shops, never its password hash", async () => {
    const out = await exportAccount(admin, merchant.id);
    expect(JSON.stringify(out)).not.toContain("password");
    expect(out).toMatchObject({ format: "akinaza-account-export/1", account: { email: merchant.email }, shops: [{ name: "Salon Laurier" }] });
  });

  it("erases an account without a shop; refuses one that owns a shop (invoices are kept six years)", async () => {
    await expect(deleteAccount(admin, merchant.id, merchant.email)).rejects.toMatchObject({ status: 409, body: { code: "RETENTION_REQUIRED" } });
    await expect(deleteAccount(admin, plain.id, "someone@else.test")).rejects.toMatchObject({ status: 409, body: { code: "CONFIRM_MISMATCH" } });
    await expect(deleteAccount(admin, admin.id, admin.email)).rejects.toMatchObject({ status: 409, body: { code: "SELF_DELETE" } });
    await query("INSERT INTO audit_log (actor_id, actor_label, action, ip) VALUES ($1, $2, 'auth.sign_in', '203.0.113.7')", [plain.id, plain.email]);
    expect(await deleteAccount(admin, plain.id, plain.email.toUpperCase())).toEqual({ deleted: true });
    await expect(userDetail(plain.id)).rejects.toMatchObject({ status: 404 });
    for (const row of await query<{ actor_label: string; ip: string | null }>("SELECT actor_label, ip FROM audit_log WHERE actor_id = $1", [plain.id])) expect(row).toEqual({ actor_label: "deleted account", ip: null });
  });
});
