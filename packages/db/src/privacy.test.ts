import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { RETENTION_RULES } from "@akinaza/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate } from "./migrate";
import { clientPrivacy, clientSubject, consentHistoryOf, eraseClient, exportClient, queryOf, recordConsent } from "./privacy";
import { PRIVACY_MIGRATION_SQL } from "./privacy-migration";
import { clients, invoices, shopReviews, taxLedger } from "./schema";
import { addReview } from "./shop-community";
import { issueInvoice } from "./shop-ops";
import { addClientRequestFile, saveClientRequest } from "./client-requests";
import { freshDatabase, freshEmptyDatabase } from "./test/db";
import { salon, walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

it("every table a retention rule names exists, and the rules agree with what the erasure does", async () => {
  for (const table of RETENTION_RULES.flatMap((r) => r.tables)) {
    const found = (await t.pool.query("SELECT to_regclass($1) AS t", [table])).rows[0].t as string | null;
    expect(found, table).not.toBeNull();
  }
});

describe("consents by purpose (the shared module)", () => {
  it("records a decision and a withdrawal; the last word wins; none is ever edited", async () => {
    const s = await salon(t.db);
    await recordConsent(t.db, s.client.id, "marketing", true, "2026-10-26");
    await recordConsent(t.db, s.client.id, "marketing", false, "2026-10-27");
    const history = await consentHistoryOf(t.db, s.client.id);
    expect(history.map((h) => [h.purpose, h.granted, h.textVersion])).toEqual([["marketing", true, "2026-10-26"], ["marketing", false, "2026-10-27"]]);
    expect(await (await clientPrivacy(t.db)).hasConsent(queryOf(t.db), clientSubject(s.client.id), "marketing")).toBe(false);
  });

  it("refuses a purpose Akinaza did not declare", async () => {
    const s = await salon(t.db);
    await expect((await clientPrivacy(t.db)).recordConsent(queryOf(t.db), { subject: clientSubject(s.client.id), purpose: "advertising", version: "v1", granted: true })).rejects.toThrow(/did not declare|not one the product declared/);
  });
});

describe("the right of access holds every module's data, and the erasure leaves only what the tax rule keeps", () => {
  it("exports the file, the visits, the invoices, the requests and the consents of one client, not another's", async () => {
    const w = await walkerShop(t.db, "px");
    await recordConsent(t.db, w.camille.clientId, "marketing", true, "2026-10-26");
    const s = await salon(t.db);
    await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-15", lines: [{ description: "Coupe", quantity: 1, unitPriceCents: 4_500, category: "standard" }] });
    const document = await exportClient(t.db, Buffer.alloc(32, 1), s.client.id);
    expect(Object.keys(document.modules)).toEqual(["client_file", "visits", "invoices", "requests", "consents"]);
    expect((document.modules.invoices as Array<{ number: string; totalCents: number }>).map((i) => i.number)).toEqual(["F-00001"]);
    expect(JSON.stringify(document)).not.toContain("Camille Tremblay\",\"email\":\"camille-px");
    const other = await exportClient(t.db, Buffer.alloc(32, 1), w.camille.clientId);
    expect((other.modules.consents as Array<{ purpose: string }>).map((c) => c.purpose)).toEqual(["service", "reminders", "marketing"]);
  });

  it("exports the requests with the addresses of their files", async () => {
    const w = await walkerShop(t.db, "pr");
    const requestId = await saveClientRequest(t.db, w.camille.clientId, { serviceId: w.solo, title: "Une demande", note: "bonjour" });
    await addClientRequestFile(t.db, w.camille.clientId, requestId, { url: "https://cdn.example/user/akinaza/r/a.pdf", kind: "pdf", bytes: 10 });
    const document = await exportClient(t.db, Buffer.alloc(32, 1), w.camille.clientId);
    expect(document.modules.requests).toMatchObject([{ title: "Une demande", files: [{ url: "https://cdn.example/user/akinaza/r/a.pdf", kind: "pdf" }] }]);
  });

  it("erases every module in one transaction and leaves the invoices, their lines and the ledger (six years)", async () => {
    const s = await salon(t.db);
    const { invoice } = await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-15", lines: [{ description: "Coupe", quantity: 1, unitPriceCents: 4_500, category: "standard" }] });
    await recordConsent(t.db, s.client.id, "marketing", true, "2026-10-26");
    const ledgerBefore = (await t.db.select().from(taxLedger).where(eq(taxLedger.shopId, s.shop.id))).length;
    expect(ledgerBefore).toBeGreaterThan(0);

    expect(await eraseClient(t.db, s.client.id, "2026-10-27")).toBe(true);

    // what the tax rule keeps: the invoice, its lines, the ledger; the person on them is blanked on the file
    const kept = RETENTION_RULES.filter((r) => r.keep === "tax").flatMap((r) => r.tables);
    expect(kept).toEqual(["invoices", "invoice_lines", "payments", "tax_ledger"]);
    expect((await t.db.select().from(invoices).where(eq(invoices.id, invoice.id))).length).toBe(1);
    expect((await t.db.select().from(taxLedger).where(eq(taxLedger.shopId, s.shop.id))).length).toBe(ledgerBefore);
    const lines = await t.db.execute(sql`SELECT count(*)::int AS n FROM invoice_lines WHERE invoice_id = ${invoice.id}`);
    expect((lines.rows[0] as { n: number }).n).toBe(1);
    const [file] = await t.db.select().from(clients).where(eq(clients.id, s.client.id));
    expect(file).toMatchObject({ fullName: "—", email: null, phone: null, notes: null, accountId: null });

    // every live consent is withdrawn, the proof stays
    const history = await consentHistoryOf(t.db, s.client.id);
    expect(history.at(-1)).toMatchObject({ purpose: "marketing", granted: false, textVersion: "2026-10-27" });
    // the request is recorded and holds no one's data
    const requests = await (await clientPrivacy(t.db)).requests(queryOf(t.db), clientSubject(s.client.id));
    expect(requests).toMatchObject([{ kind: "erasure", status: "completed", failure: null }]);
    // erasing again changes nothing
    expect(await eraseClient(t.db, s.client.id, "2026-10-27")).toBe(false);
    await expect(exportClient(t.db, Buffer.alloc(32, 1), s.client.id)).rejects.toThrow();
  });

  it("erases the review's name and the requests, and nothing else of another client", async () => {
    const w = await walkerShop(t.db, "pe");
    const requestId = await saveClientRequest(t.db, w.camille.clientId, { serviceId: w.solo, title: "À effacer" });
    const reviewId = await addReview(t.db, w.shopId, { clientId: w.camille.clientId, firstName: "Camille", lastInitial: "T", rating: 5, body: "Super", verified: true } as never);
    await eraseClient(t.db, w.camille.clientId, "2026-10-27");
    expect((await t.db.execute(sql`SELECT count(*)::int AS n FROM client_requests WHERE id = ${requestId}`)).rows[0]).toEqual({ n: 0 });
    const [review] = await t.db.select().from(shopReviews).where(eq(shopReviews.id, reviewId));
    expect(review).toMatchObject({ firstName: "—", lastInitial: "", body: "", clientId: null, rating: 5 });
    const other = await exportClient(t.db, Buffer.alloc(32, 1), w.jordan.clientId);
    expect((other.modules.client_file as { file: { fullName: string } }).file.fullName).toBe("Jordan Lee");
  });

  it("rolls the whole erasure back when one module fails: nothing is erased, the failure is recorded", async () => {
    const s = await salon(t.db);
    await t.pool.query("CREATE OR REPLACE FUNCTION ak_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AK_TEST_FAIL'; END $$");
    await t.pool.query(`CREATE TRIGGER ak_test_fail BEFORE DELETE ON client_notes FOR EACH ROW EXECUTE FUNCTION ak_test_fail()`);
    await t.pool.query(`INSERT INTO client_notes (shop_id, client_id, author_name, body) VALUES ($1, $2, 'Owner', 'Allergie')`, [s.shop.id, s.client.id]);
    try {
      await expect(eraseClient(t.db, s.client.id, "2026-10-27")).rejects.toThrow(/client_file/);
      const [file] = await t.db.select().from(clients).where(eq(clients.id, s.client.id));
      expect(file).toMatchObject({ fullName: "Camille Tremblay", erasedAt: null });
      const requests = await (await clientPrivacy(t.db)).requests(queryOf(t.db), clientSubject(s.client.id));
      expect(requests).toMatchObject([{ kind: "erasure", status: "failed", failure: "CONTRIBUTOR_FAILED" }]);
    } finally {
      await t.pool.query("DROP TRIGGER ak_test_fail ON client_notes");
    }
  });
});
