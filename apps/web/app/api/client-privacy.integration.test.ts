import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

import { apiCall, closeSuite, type Handler, openBookableShop, testAccount } from "./test-api";
import { POST as erase } from "./walker/clients/[id]/erase/route";
import { GET as exportData } from "./walker/clients/[id]/export/route";

/** The shop answers a client's access and erasure requests from the console (akinaza#370). Real PostgreSQL (DATABASE_IT=1). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("a client's access and erasure answered by the shop", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const people = {} as Record<"owner" | "manager" | "other", { id: string; token: string }>;
  let shopId: string;
  let clientId: string;
  const call = (handler: unknown, method: string, token: string | undefined, id: string, opts: { json?: unknown } = {}) => apiCall(handler as Handler, method, `/api/walker/clients/${id}/x`, { token, params: { id }, ...opts });

  beforeAll(async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    await migrate();
    for (const label of ["owner", "manager", "other"] as const) people[label] = await testAccount(label, stamp);
    shopId = (await openBookableShop(people.owner.token, "Atelier P", `p-${stamp}`)).shopId;
    await openBookableShop(people.other.token, "Atelier Q", `q-${stamp}`);
    await query("INSERT INTO memberships (scope_id, account_id, role, created_at) VALUES ($1, $2, 'manager', now())", [shopId, people.manager.id]);
    clientId = (await query<{ id: string }>("INSERT INTO clients (shop_id, full_name, email) VALUES ($1, 'Camille Test', 'camille@example.test') RETURNING id", [shopId]))[0]!.id;
    await query("INSERT INTO privacy.consent (id, subject_kind, subject_id, purpose, version, granted, at) VALUES (gen_random_uuid(), 'client', $1, 'marketing', '2026-10-01', true, now())", [clientId]);
  });
  beforeEach(() => resetRateLimits());
  afterAll(() => closeSuite(stamp));

  it("lets only the owner ask: the manager is refused, another shop's owner finds nothing", async () => {
    expect((await call(exportData, "GET", people.manager.token, clientId)).status).toBe(403);
    expect((await call(erase, "POST", people.manager.token, clientId, { json: { confirm: true } })).status).toBe(403);
    expect((await call(exportData, "GET", people.other.token, clientId)).status).toBe(404);
    expect((await call(exportData, "GET", undefined, clientId)).status).toBe(401);
  });

  it("exports the document, then erases on a confirmed request, and writes both to the audit log", async () => {
    const out = await call(exportData, "GET", people.owner.token, clientId);
    expect(out.status).toBe(200);
    expect((await call(erase, "POST", people.owner.token, clientId, { json: {} })).status).toBe(400);
    expect((await call(erase, "POST", people.owner.token, clientId, { json: { confirm: true } })).body).toEqual({ ok: true, erased: true });
    const [file] = await query<{ full_name: string; email: string | null; erased_at: string | null }>("SELECT full_name, email, erased_at FROM clients WHERE id = $1", [clientId]);
    expect(file).toMatchObject({ full_name: "—", email: null });
    expect(file!.erased_at).not.toBeNull();
    const last = await query<{ granted: boolean }>("SELECT granted FROM privacy.consent WHERE subject_id = $1 AND purpose = 'marketing' ORDER BY seq DESC LIMIT 1", [clientId]);
    expect(last[0]!.granted).toBe(false);
    const actions = (await query<{ action: string }>("SELECT action FROM audit_log WHERE target_id = $1 ORDER BY id", [clientId])).map((r) => r.action);
    expect(actions).toEqual(["client.exported_by_shop", "client.erased_by_shop"]);
    expect((await call(exportData, "GET", people.owner.token, clientId)).status).not.toBe(200);
  });
});
