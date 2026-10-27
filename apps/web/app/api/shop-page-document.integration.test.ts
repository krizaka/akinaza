import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

import { apiCall, closeSuite, type Handler, openBookableShop, testAccount } from "./test-api";
import { POST as discard } from "./walker/page/discard/route";
import { GET as getDraft, PUT as putDraft } from "./walker/page/draft/route";
import { POST as publish } from "./walker/page/publish/route";
import { POST as rollback } from "./walker/page/rollback/route";
import { GET as versions } from "./walker/page/versions/route";

/** The shop page as a document over HTTP (akinaza#400): who may write and publish, a refused document, one audit row each. Real PostgreSQL (DATABASE_IT=1). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("the shop page document over HTTP", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const people = {} as Record<"owner" | "manager" | "staff" | "other", { id: string; token: string }>;
  let shopId: string;
  const call = (handler: unknown, method: string, token: string | undefined, json?: unknown) => apiCall(handler as Handler, method, "/api/walker/page/x", { token, json });
  const audits = async (action: string) => (await query("SELECT 1 FROM audit_log WHERE action = $1 AND target_id = $2", [action, shopId])).length;

  beforeAll(async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    await migrate();
    for (const label of ["owner", "manager", "staff", "other"] as const) people[label] = await testAccount(label, stamp);
    shopId = (await openBookableShop(people.owner.token, "Atelier P", `p-${stamp}`)).shopId;
    await openBookableShop(people.other.token, "Atelier Q", `q-${stamp}`);
    for (const label of ["manager", "staff"] as const) await query("INSERT INTO memberships (scope_id, account_id, role, created_at) VALUES ($1, $2, $3, now())", [shopId, people[label].id, label]);
  });
  beforeEach(() => resetRateLimits());
  afterAll(() => closeSuite(stamp));

  it("reads the starter for a new shop, saves a draft, and lets a manager publish it with one audit row per action", async () => {
    const start = await call(getDraft, "GET", people.staff.token);
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ draft: false, version: null });
    const doc = start.body.page;
    expect((await call(putDraft, "PUT", people.manager.token, doc)).status).toBe(200);
    expect((await call(publish, "POST", people.manager.token)).body).toEqual({ version: 2 });
    expect(await audits("shop.page_draft_saved")).toBe(1);
    expect(await audits("shop.page_published")).toBe(1);
    const list = await call(versions, "GET", people.staff.token);
    expect(list.body.versions.map((v: { status: string }) => v.status)).toEqual(["published"]);
  });

  it("refuses an invalid document with a 422 and the path of each issue, and keeps the page", async () => {
    const doc = (await call(getDraft, "GET", people.owner.token)).body.page;
    const bad = { ...doc, sections: [{ ...doc.sections[0], variant: "nope" }, ...doc.sections.slice(1)] };
    const res = await call(putDraft, "PUT", people.owner.token, bad);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("SHOP_PAGE_INVALID");
    expect(res.body.issues[0].path).toMatch(/^sections\.0/);
    expect((await call(getDraft, "GET", people.owner.token)).body.draft).toBe(false);
  });

  it("keeps the staff from writing, publishing and rolling back (403), and another shop from this shop's versions (404)", async () => {
    const doc = (await call(getDraft, "GET", people.owner.token)).body.page;
    expect((await call(putDraft, "PUT", people.staff.token, doc)).status).toBe(403);
    expect((await call(publish, "POST", people.staff.token)).status).toBe(403);
    expect((await call(rollback, "POST", people.staff.token, { version: 1 })).status).toBe(403);
    expect((await call(rollback, "POST", people.other.token, { version: 2 })).status).toBe(404);
    expect((await call(publish, "POST", people.owner.token)).status).toBe(409);
  });

  it("rolls back to an archived version as a new published version, audited", async () => {
    const doc = (await call(getDraft, "GET", people.owner.token)).body.page;
    await call(putDraft, "PUT", people.owner.token, doc);
    const second = (await call(publish, "POST", people.owner.token)).body.version as number;
    const back = await call(rollback, "POST", people.owner.token, { version: 2 });
    expect(back.status).toBe(200);
    expect(back.body.version).toBeGreaterThan(second);
    expect(await audits("shop.page_rolled_back")).toBe(1);
  });

  it("discards the draft (audited once, owner and manager only) and resets it on rollback unless asked to keep it", async () => {
    const doc = (await call(getDraft, "GET", people.owner.token)).body.page;
    await call(putDraft, "PUT", people.owner.token, doc);
    expect((await call(discard, "POST", people.staff.token)).status).toBe(403);
    expect((await call(discard, "POST", people.manager.token)).body).toEqual({ discarded: true });
    expect((await call(discard, "POST", people.manager.token)).body).toEqual({ discarded: false });
    expect(await audits("shop.page_draft_discarded")).toBe(1);
    expect((await call(getDraft, "GET", people.owner.token)).body.draft).toBe(false);
    await call(putDraft, "PUT", people.owner.token, doc);
    const archived = (await call(versions, "GET", people.owner.token)).body.versions.find((v: { status: string }) => v.status === "archived");
    expect((await call(rollback, "POST", people.owner.token, { version: archived.version })).body.draftReset).toBe(true);
    expect((await call(getDraft, "GET", people.owner.token)).body.draft).toBe(false);
  });
});
