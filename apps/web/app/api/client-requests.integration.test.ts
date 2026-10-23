import { randomUUID } from "node:crypto";

import { addClientRequestFile, eraseClientRequests } from "@akinaza/db";
import { seedDemoShop } from "@akinaza/db/seed";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db, migrate, pool, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/session";

import { POST as uploadFile } from "./me/requests/[id]/files/route";
import { DELETE as deleteRequest } from "./me/requests/[id]/route";
import { GET as listRequests, POST as saveRequest } from "./me/requests/route";

/** « Mes demandes » over HTTP (akinaza#210), on a real PostgreSQL (CI's service; locally DATABASE_IT=1 DATABASE_URL=…). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;
async function call(handler: unknown, method: string, path: string, opts: { cookie?: string; json?: unknown; body?: BodyInit; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = `${SESSION_COOKIE}=${opts.cookie}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const body = opts.json !== undefined ? JSON.stringify(opts.json) : opts.body;
  const res = await (handler as Handler)(new Request(`http://localhost${path}`, { method, headers, body }), { params: Promise.resolve((opts.params ?? {}) as never) });
  return { status: res.status, body: (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : null };
}

describe.runIf(enabled)("a client's requests at a shop", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  let client: string;
  let alice: string;
  let bob: string;
  let serviceId: string;
  let foreignService: string;

  beforeAll(async () => {
    await migrate();
    const account = async (label: string) => (await query<{ id: string }>("INSERT INTO accounts (email, role, password_hash) VALUES ($1, 'USER', 'x') RETURNING id", [`${label}-${stamp}@akinaza.test`]))[0]!.id;
    const [owner, other, aliceId, bobId] = [await account("req-owner"), await account("req-other"), await account("req-alice"), await account("req-bob")];
    const { shopId } = await seedDemoShop(db(), `req-owner-${stamp}@akinaza.test`);
    const { shopId: otherShop } = await seedDemoShop(db(), `req-other-${stamp}@akinaza.test`);
    void owner;
    void other;
    client = (await query<{ id: string }>("UPDATE clients SET account_id = $1 WHERE id = (SELECT id FROM clients WHERE shop_id = $2 ORDER BY created_at LIMIT 1) RETURNING id", [aliceId, shopId]))[0]!.id;
    serviceId = (await query<{ id: string }>("SELECT id FROM services WHERE shop_id = $1 LIMIT 1", [shopId]))[0]!.id;
    foreignService = (await query<{ id: string }>("SELECT id FROM services WHERE shop_id = $1 LIMIT 1", [otherShop]))[0]!.id;
    alice = (await createSession(aliceId, { ip: null, userAgent: "vitest" })).token;
    bob = (await createSession(bobId, { ip: null, userAgent: "vitest" })).token;
  });
  beforeEach(() => resetRateLimits());
  afterAll(async () => {
    await pool().end();
  });

  it("the client keeps a request and reads it back; nobody else can, nor with another shop's service", async () => {
    const saved = await call(saveRequest, "POST", "/api/me/requests", { cookie: alice, json: { clientId: client, serviceId, title: "Coupe + balayage", note: "Comme la dernière fois" } });
    expect(saved.status).toBe(201);
    const mine = await call(listRequests, "GET", `/api/me/requests?clientId=${client}`, { cookie: alice });
    expect(mine.body.requests).toMatchObject([{ id: saved.body.id, title: "Coupe + balayage", note: "Comme la dernière fois", serviceId, files: [] }]);
    expect((await call(listRequests, "GET", `/api/me/requests?clientId=${client}`, { cookie: bob })).status).toBe(404);
    expect((await call(saveRequest, "POST", "/api/me/requests", { cookie: bob, json: { clientId: client, serviceId, title: "x" } })).status).toBe(404);
    expect((await call(saveRequest, "POST", "/api/me/requests", { cookie: alice, json: { clientId: client, serviceId: foreignService, title: "x" } })).body).toMatchObject({ code: "SERVICE_UNKNOWN" });
  });

  it("a request keeps at most five files; uploading without a storage answers 503; deleting returns the files' addresses", async () => {
    const id = (await call(saveRequest, "POST", "/api/me/requests", { cookie: alice, json: { clientId: client, serviceId, title: "Avec photo" } })).body.id as string;
    for (let i = 0; i < 5; i++) await addClientRequestFile(db(), client, id, { url: `https://cdn.example/user/akinaza/r/${i}.jpg`, kind: "image", bytes: 10 });
    await expect(addClientRequestFile(db(), client, id, { url: "https://cdn.example/user/akinaza/r/6.jpg", kind: "image", bytes: 10 })).rejects.toMatchObject({ code: "AK_REQUEST_FILES_FULL" });
    const form = new FormData();
    form.set("clientId", client);
    form.set("file", new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "cut.jpg"));
    expect((await call(uploadFile, "POST", `/api/me/requests/${id}/files`, { cookie: alice, body: form, params: { id } })).status).toBe(503);
    expect((await call(deleteRequest, "DELETE", `/api/me/requests/${id}`, { cookie: bob, json: { clientId: client }, params: { id } })).status).toBe(404);
    expect((await call(deleteRequest, "DELETE", `/api/me/requests/${id}`, { cookie: alice, json: { clientId: client }, params: { id } })).status).toBe(200);
    expect((await query("SELECT 1 FROM client_request_files WHERE request_id = $1", [id])).length).toBe(0);
  });

  it("erasing the client removes every request and answers the files to delete from the storage (Loi 25)", async () => {
    const id = (await call(saveRequest, "POST", "/api/me/requests", { cookie: alice, json: { clientId: client, serviceId, title: "À effacer" } })).body.id as string;
    await addClientRequestFile(db(), client, id, { url: "https://cdn.example/user/akinaza/r/erase.pdf", kind: "pdf", bytes: 10 });
    expect(await eraseClientRequests(db(), client)).toContain("https://cdn.example/user/akinaza/r/erase.pdf");
    expect((await query("SELECT 1 FROM client_requests WHERE client_id = $1", [client])).length).toBe(0);
  });
});
