import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { INVOICE_STATE, invoiceState, localDay } from "@akinaza/core";
import { workspaceMigration } from "@krizaka/organize";
import { parseView } from "@krizaka/organize/contract";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WORKSPACE_MIGRATION_HEADER } from "./gen-workspace-migration";
import { recordPayment } from "./invoice-payments";
import { saveShopPage } from "./service-shop";
import { creditNote, issueShopInvoice, replaceInvoice } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { clients, shops } from "./schema";
import { account, salon } from "./test/fixtures";
import { transactionOn } from "./transaction";
import { CLIENT_KIND, INVOICE_KIND, INVOICE_STATUS_SET } from "./workspace-defaults";
import { actorOf, ensureShopWorkspace, idsMatching, tagCounts, WORKSPACE, workspaceOf } from "./workspace";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const clock = { now: () => new Date("2026-10-26T15:00:00Z") };
const deps = () => ({ transaction: <T>(work: Parameters<typeof transactionOn<T>>[1]) => transactionOn(t.pool, work), clock });
const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await t.pool.query(sql, params)).rows as R[];

/** A shop, its owner and a manager and a staff member of it. */
async function shopWith(label: string) {
  const s = await salon(t.db);
  const owner = await account(t.db, `${label}-owner@example.test`);
  const manager = await account(t.db, `${label}-manager@example.test`);
  const staff = await account(t.db, `${label}-staff@example.test`);
  await t.db.update(shops).set({ ownerId: owner.id }).where(eq(shops.id, s.shop.id));
  await ensureShopWorkspace(deps(), s.shop.id);
  return { ...s, shopId: s.shop.id, ws: workspaceOf(deps(), s.shop.id), as: { owner: actorOf(owner, "owner"), manager: actorOf(manager, "manager"), staff: actorOf(staff, "staff") } };
}
const moreClients = async (shopId: string, n: number) =>
  (await t.db.insert(clients).values(Array.from({ length: n }, (_, i) => ({ shopId, fullName: `Client ${i}`, language: "fr" as const }))).returning({ id: clients.id })).map((c) => c.id);

describe("the invoice's state in SQL is the state of the list (`invoiceState`)", () => {
  it("agrees on due, partly paid, overdue, paid, cancelled by a credit note, replaced by a correction, and the credit note itself", async () => {
    const s = await salon(t.db);
    await ensureShopWorkspace(deps(), s.shop.id);
    const line = [{ serviceId: s.services.cut.id, quantity: 1 }];
    const issue = (issuedOn: string) => issueShopInvoice(t.db, s.shop.id, { clientId: s.client.id, language: "fr", issuedOn, lines: line });
    const due = (await issue("2099-01-01")).invoice;
    const partial = (await issue("2099-01-02")).invoice;
    await recordPayment(t.db, s.shop.id, partial.id, { amountCents: 100, method: "cash" }, clock.now());
    const overdue = (await issue("2020-01-01")).invoice;
    const paid = (await issue("2099-01-03")).invoice;
    await recordPayment(t.db, s.shop.id, paid.id, { amountCents: paid.totalCents, method: "cash" }, clock.now());
    const cancelled = (await issue("2099-01-04")).invoice;
    const credit = (await creditNote(t.db, cancelled.id, "2026-10-21")).invoice;
    const original = (await issue("2099-01-05")).invoice;
    const replaced = await replaceInvoice(t.db, s.shop.id, original.id, { language: "fr", issuedOn: "2099-01-05", lines: line });
    const expected = new Map([[due.id, "due"], [partial.id, "partial"], [overdue.id, "overdue"], [paid.id, "paid"], [cancelled.id, "cancelled"], [credit.id, "credit"], [original.id, "cancelled"]]);
    const stateSql = WORKSPACE.kinds.invoice!.stateSql!;
    const rows = await q<{ id: string; state: string }>(`SELECT e.id, (${stateSql}) AS state FROM invoices e WHERE e.shop_id = $1`, [s.shop.id]);
    for (const [id, state] of expected) expect(rows.find((r) => r.id === id)?.state, state).toBe(state);
    // ... and the pure rule gives the same for every invoice of the list
    const today = localDay(new Date(), "America/Toronto");
    const detail = await q<{ id: string; total_cents: number; due_on: string | null; credit_of: string | null; paid: number; superseded: boolean }>(
      `SELECT i.id, i.total_cents, to_char(i.due_on, 'YYYY-MM-DD') AS due_on, i.credit_of,
              COALESCE((SELECT sum(amount_cents) FROM payments p WHERE p.invoice_id = i.id), 0)::int AS paid,
              EXISTS (SELECT 1 FROM invoices o WHERE o.credit_of = i.id OR o.replaces = i.id) AS superseded FROM invoices i WHERE i.shop_id = $1`,
      [s.shop.id],
    );
    for (const d of detail) expect(rows.find((r) => r.id === d.id)?.state).toBe(invoiceState({ totalCents: d.total_cents, paidCents: d.paid, dueOn: d.due_on, isCredit: d.credit_of !== null, superseded: d.superseded }, today));
    expect(rows.find((r) => r.id === replaced.replacement.id)?.state).toBe("due");
    expect(new Set(rows.map((r) => r.state))).toEqual(new Set(Object.values(INVOICE_STATE)));
  });
});

describe("a shop's default tag set, seeded as data", () => {
  it("copies the defaults for the shop's trade and the owner's language, once", async () => {
    const owner = await account(t.db, "seed-en@example.test");
    await t.pool.query("UPDATE accounts SET locale = 'en' WHERE id = $1", [owner.id]);
    const { shopId } = await saveShopPage(t.db, owner.id, { name: "Pattes", legalName: "Pattes", address: "1 rue Test", slug: "pattes-seed", ownerName: "Mathilde", businessType: "pets" });
    await ensureShopWorkspace(deps(), shopId);
    const ws = workspaceOf(deps(), shopId);
    expect((await ws.tags.list(shopId, "client")).map((x) => x.name).sort()).toEqual(["Cat", "Dog", "First visit", "Regular", "To call back"]);
    expect((await ws.tags.list(shopId, "invoice")).map((x) => x.name)).toContain("To chase");
    // a tag the owner deletes does not come back, and a second call writes nothing
    const [dog] = (await ws.tags.list(shopId, "client")).filter((x) => x.name === "Dog");
    await ws.tags.remove(shopId, actorOf(owner, "owner"), "client", dog!.id);
    await ensureShopWorkspace(deps(), shopId);
    expect(await ws.tags.list(shopId, "client")).toHaveLength(4);
    expect((await q("SELECT organized_at FROM shops WHERE id = $1", [shopId]))[0]).toMatchObject({ organized_at: clock.now() });
  });

  it("uses the French set of a trade by default, and the default set for a trade without one", async () => {
    const s = await shopWith("fr");
    expect((await s.ws.tags.list(s.shopId, "client")).map((x) => x.name)).toContain("Mandat en cours"); // no trade chosen: a professional's consulting set
    const studio = await account(t.db, "studio-seed@example.test");
    const { shopId } = await saveShopPage(t.db, studio.id, { name: "Studio", legalName: "Studio", address: "1 rue Test", slug: "studio-seed", ownerName: "Éric", businessType: "professional" });
    await ensureShopWorkspace(deps(), shopId);
    await t.pool.query("INSERT INTO shop_page (shop_id, shop_type) VALUES ($1, 'cleaning') ON CONFLICT (shop_id) DO UPDATE SET shop_type = 'cleaning'", [shopId]);
    await t.pool.query("UPDATE shops SET organized_at = NULL WHERE id = $1", [shopId]);
    await ensureShopWorkspace(deps(), shopId);
    expect((await workspaceOf(deps(), shopId).tags.list(shopId, "client")).map((x) => x.name)).toContain("Résidentiel");
  });

  it("the administrator's configuration is the source of truth: seeding never overwrites it, and an edit shapes the next shop", async () => {
    const s = await shopWith("cfg");
    const stored = (await s.ws.config.get("client"))!;
    const edited = { ...stored.config, tags: { ...stored.config.tags, max: 60, presets: { ...stored.config.tags.presets, default: [{ name: "Ambassadeur", marker: "green" as const }] } } };
    const put = await s.ws.config.put(s.as.owner, edited, stored.version);
    expect(put.version).toBe(stored.version + 1);
    await expect(s.ws.config.put(s.as.owner, edited, stored.version)).rejects.toMatchObject({ code: "CONFLICT" });
    await s.ws.config.seed(CLIENT_KIND);
    expect((await s.ws.config.get("client"))!.config.tags.max).toBe(60);
    expect(await q("SELECT 1 FROM audit_log WHERE action = 'organize.config_changed' AND target_id = 'client'")).toHaveLength(1);
    const other = await account(t.db, "cfg-next@example.test");
    const { shopId } = await saveShopPage(t.db, other.id, { name: "Atelier", legalName: "Atelier", address: "1 rue Test", slug: "atelier-cfg", ownerName: "Éric", businessType: "professional" });
    await t.pool.query("INSERT INTO shop_page (shop_id, shop_type) VALUES ($1, 'cleaning') ON CONFLICT (shop_id) DO UPDATE SET shop_type = 'cleaning'", [shopId]).catch(() => undefined);
    await ensureShopWorkspace(deps(), shopId);
    expect((await workspaceOf(deps(), shopId).tags.list(shopId, "client")).length).toBeGreaterThan(0);
  });
});

describe("tags are the shop's: the owner and the manager write, staff read", () => {
  it("refuses a tag from staff (403), accepts the manager and the owner, and keeps names unique per shop", async () => {
    const s = await shopWith("roles");
    await expect(s.ws.tags.create(s.shopId, s.as.staff, "client", { name: "Secret", marker: "red" })).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    const tag = await s.ws.tags.create(s.shopId, s.as.manager, "client", { name: "Quartier Est", marker: "blue" });
    await s.ws.tags.update(s.shopId, s.as.owner, "client", tag.id, { marker: "amber" });
    await expect(s.ws.tags.create(s.shopId, s.as.owner, "client", { name: "quartier est", marker: "red" })).rejects.toMatchObject({ code: "NAME_TAKEN" });
    await expect(s.ws.tags.remove(s.shopId, s.as.staff, "client", tag.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await s.ws.tags.list(s.shopId, "client")).find((x) => x.id === tag.id)).toMatchObject({ marker: "amber", origin: "user" });
  });

  it("another shop's tag, view and entity ids are a 404 (NOT_FOUND), and nothing of it changes", async () => {
    const a = await shopWith("iso-a");
    const b = await shopWith("iso-b");
    const tagA = await a.ws.tags.create(a.shopId, a.as.owner, "client", { name: "Privé A", marker: "violet" });
    const viewA = await a.ws.views.create(a.shopId, a.as.owner, "client", { name: "Vue A", filters: { tags: [tagA.id] }, shared: true });
    await expect(b.ws.tags.update(b.shopId, b.as.owner, "client", tagA.id, { name: "Pris" })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(b.ws.tags.remove(b.shopId, b.as.owner, "client", tagA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.ws.tags.apply(b.shopId, b.as.owner, "client", { ids: [b.client.id], add: [tagA.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.ws.tags.apply(b.shopId, b.as.owner, "client", { ids: [a.client.id], add: [(await b.ws.tags.list(b.shopId, "client"))[0]!.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.ws.views.update(b.shopId, b.as.owner, viewA.id, { name: "Pris" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.ws.views.remove(b.shopId, b.as.owner, viewA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await b.ws.views.list(b.shopId, b.as.owner, "client")).workspace).toEqual([]);
    expect((await a.ws.tags.list(a.shopId, "client")).some((x) => x.id === tagA.id)).toBe(true);
    expect(await q("SELECT 1 FROM organize.client_tag WHERE entity_id = $1", [a.client.id])).toHaveLength(0);
  });
});

describe("bulk tag and untag: at most 200, one transaction, one audit line per entity", () => {
  it("tags and untags a selection, one audit line per client that changed", async () => {
    const s = await shopWith("bulk");
    const ids = await moreClients(s.shopId, 5);
    const [t1, t2] = await Promise.all([s.ws.tags.create(s.shopId, s.as.owner, "client", { name: "T1", marker: "blue" }), s.ws.tags.create(s.shopId, s.as.owner, "client", { name: "T2", marker: "green" })]);
    expect(await s.ws.tags.apply(s.shopId, s.as.manager, "client", { ids, add: [t1.id, t2.id] })).toBe(5);
    expect(await q("SELECT 1 FROM audit_log WHERE action = 'organize.tags_changed' AND detail->>'shopId' = $1", [s.shopId])).toHaveLength(5);
    expect(await s.ws.tags.apply(s.shopId, s.as.manager, "client", { ids, add: [t1.id] })).toBe(0); // nothing to do: no line
    expect(await s.ws.tags.apply(s.shopId, s.as.manager, "client", { ids: ids.slice(0, 2), remove: [t2.id] })).toBe(2);
    expect(await q("SELECT 1 FROM audit_log WHERE action = 'organize.tags_changed' AND detail->>'shopId' = $1", [s.shopId])).toHaveLength(7);
    const counts = await tagCounts(async (sql, params) => (await t.pool.query(sql, params)).rows as never, "client", s.shopId);
    expect([counts.get(t1.id), counts.get(t2.id)]).toEqual([5, 3]);
    await expect(s.ws.tags.apply(s.shopId, s.as.staff, "client", { ids, add: [t1.id] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses more than 200 at once, and a selection with one foreign id changes nothing", async () => {
    const s = await shopWith("limit");
    const other = await shopWith("limit-other");
    const ids = await moreClients(s.shopId, 3);
    const tag = await s.ws.tags.create(s.shopId, s.as.owner, "client", { name: "Lot", marker: "gray" });
    const tooMany = Array.from({ length: 201 }, () => randomUUID());
    await expect(s.ws.tags.apply(s.shopId, s.as.owner, "client", { ids: tooMany, add: [tag.id] })).rejects.toMatchObject({ code: "TOO_MANY" });
    await expect(s.ws.tags.apply(s.shopId, s.as.owner, "client", { ids: [...ids, other.client.id], add: [tag.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await q("SELECT 1 FROM organize.client_tag WHERE tag_id = $1", [tag.id])).toHaveLength(0);
    const fifty = await moreClients(s.shopId, 200);
    expect(await s.ws.tags.apply(s.shopId, s.as.owner, "client", { ids: fifty, add: [tag.id] })).toBe(200);
  });

  it("tags invoices too, and no bulk action touches the ledger or an invoice", async () => {
    const s = await shopWith("ledger");
    const issued = [];
    for (const day of ["2026-10-01", "2026-10-02", "2026-10-03"]) issued.push((await issueShopInvoice(t.db, s.shopId, { clientId: s.client.id, language: "fr", issuedOn: day, lines: [{ serviceId: s.services.cut.id, quantity: 1 }] })).invoice.id);
    const snapshot = async () => ({
      ledger: await q("SELECT * FROM tax_ledger WHERE shop_id = $1 ORDER BY id", [s.shopId]),
      invoices: await q("SELECT * FROM invoices WHERE shop_id = $1 ORDER BY number", [s.shopId]),
      payments: await q("SELECT p.* FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.shop_id = $1 ORDER BY p.id", [s.shopId]),
    });
    const before = await snapshot();
    expect(before.ledger.length).toBeGreaterThan(0);
    const tag = (await s.ws.tags.list(s.shopId, "invoice")).find((x) => x.name === "À relancer")!;
    expect(await s.ws.tags.apply(s.shopId, s.as.manager, "invoice", { ids: issued, add: [tag.id] })).toBe(3);
    expect(await s.ws.tags.apply(s.shopId, s.as.manager, "invoice", { ids: issued.slice(1), remove: [tag.id] })).toBe(2);
    await s.ws.tags.remove(s.shopId, s.as.owner, "invoice", tag.id);
    expect(await snapshot()).toEqual(before);
  });

  it("an invoice's state cannot be moved by hand: STATUS_DERIVED, no bulk status exists", async () => {
    const s = await shopWith("derived");
    const { invoice } = await issueShopInvoice(t.db, s.shopId, { language: "fr", issuedOn: "2026-10-01", lines: [{ serviceId: s.services.cut.id, quantity: 1 }] });
    await expect(s.ws.status.move(s.shopId, s.as.owner, "invoice", { ids: [invoice.id], to: "paid" })).rejects.toMatchObject({ code: "STATUS_DERIVED", status: 409 });
    expect(await q("SELECT 1 FROM organize.invoice_status")).toHaveLength(0);
    expect(INVOICE_STATUS_SET.mode).toBe("derived");
  });
});

describe("saved views: the database keeps the name, the address holds the state", () => {
  it("lists system, workspace (shared) and mine; only the author changes a view", async () => {
    const s = await shopWith("views");
    const mine = await s.ws.views.create(s.shopId, s.as.owner, "invoice", { name: "Mes retards", filters: { status: ["overdue"] } });
    const shared = await s.ws.views.create(s.shopId, s.as.manager, "invoice", { name: "À relancer", filters: { status: ["due", "overdue"], q: "F-0" }, shared: true });
    const forOwner = await s.ws.views.list(s.shopId, s.as.owner, "invoice");
    expect(forOwner.system.map((v) => v.key)).toEqual(INVOICE_KIND.views.map((v) => v.key));
    expect(forOwner.workspace.map((v) => v.name)).toEqual(["À relancer"]);
    expect(forOwner.mine.map((v) => v.name)).toEqual(["Mes retards"]);
    const forManager = await s.ws.views.list(s.shopId, s.as.manager, "invoice");
    expect(forManager.mine).toEqual([]);
    await expect(s.ws.views.update(s.shopId, s.as.owner, shared.id, { name: "Pris" })).rejects.toBeTruthy();
    await s.ws.views.update(s.shopId, s.as.manager, shared.id, { shared: false });
    expect((await s.ws.views.list(s.shopId, s.as.owner, "invoice")).workspace).toEqual([]);
    await s.ws.views.remove(s.shopId, s.as.owner, mine.id);
    await expect(s.ws.views.create(s.shopId, s.as.owner, "invoice", { name: "Faux", filters: { status: ["nope"] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("filters the list by tags (all of them), state, text and day: the same filter a view and an address carry", async () => {
    const s = await shopWith("filters");
    const run = (kind: "client" | "invoice", search: string) => idsMatching(async (sql, params) => (await t.pool.query(sql, params)).rows as never, kind, s.shopId, parseView(new URLSearchParams(search)).filters);
    const [a, b, c] = await moreClients(s.shopId, 3);
    const [red, blue] = await Promise.all([s.ws.tags.create(s.shopId, s.as.owner, "client", { name: "Rouge", marker: "red" }), s.ws.tags.create(s.shopId, s.as.owner, "client", { name: "Bleu", marker: "blue" })]);
    await s.ws.tags.apply(s.shopId, s.as.owner, "client", { ids: [a!, b!], add: [red.id] });
    await s.ws.tags.apply(s.shopId, s.as.owner, "client", { ids: [b!, c!], add: [blue.id] });
    expect(await run("client", "")).toBeNull();
    expect((await run("client", `tags=${red.id}`))!.sort()).toEqual([a, b].sort());
    expect(await run("client", `tags=${red.id},${blue.id}`)).toEqual([b]);
    expect(await run("client", `tags=${red.id}&q=client%202`)).toEqual([]);
    expect(await run("client", `q=client%202`)).toEqual([c]);
    const open = (await issueShopInvoice(t.db, s.shopId, { language: "fr", issuedOn: "2099-01-01", lines: [{ serviceId: s.services.cut.id, quantity: 1 }] })).invoice;
    const late = (await issueShopInvoice(t.db, s.shopId, { language: "fr", issuedOn: "2020-01-01", lines: [{ serviceId: s.services.cut.id, quantity: 1 }] })).invoice;
    expect(await run("invoice", "status=overdue")).toEqual([late.id]);
    expect(await run("invoice", "status=due,overdue")).toHaveLength(2);
    expect(await run("invoice", "from=2099-01-01&to=2099-01-31")).toEqual([open.id]);
    expect(await run("invoice", `q=${late.number}`)).toEqual([late.id]);
    // another shop's entities are never selected
    const other = await shopWith("filters-other");
    expect(await run("client", `q=${encodeURIComponent("Camille")}`)).not.toContain(other.client.id);
  });
});
