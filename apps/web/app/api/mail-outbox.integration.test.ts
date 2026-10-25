import { randomUUID } from "node:crypto";

import { enqueueMail } from "@akinaza/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, migrate, pool, query } from "@/lib/db";
import { flushOutbox } from "@/lib/mail";

/**
 * akinaza#341: the integration files share CI's database and run in parallel. A file that flushed « the outbox » took the 50
 * oldest pending mails of every file: its own report mail could wait behind another file's mails (and never reach its five
 * attempts), and it sent or failed the other files' mails. A flush in a test is scoped to what that test queued.
 */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("a scoped flush of the outbox (akinaza#341)", () => {
  const tag = `flush-${randomUUID().slice(0, 8)}`;
  const settings = { provider: "mailgun" as const, apiKey: "test-only", domain: "mg.example.test", from: "Akinaza <a@mg.example.test>", apiUrl: "https://api.mailgun.net", appUrl: "https://dev.akinaza.com" };
  const ok = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
  const mail = (to: string) => ({ to, locale: "fr" as const, template: "test", subject: "test", html: "<p>x</p>", text: "x", relatedKind: "test", relatedId: randomUUID() });
  let mine: string;

  beforeAll(async () => {
    await migrate();
    // Another file's mails, older than this one's and more than one batch: what a parallel CI run looks like.
    for (let i = 0; i < 60; i++) await enqueueMail(db(), mail(`${tag}-other-${i}@example.test`));
    mine = await enqueueMail(db(), mail(`${tag}-mine@example.test`));
  });
  afterAll(async () => {
    await query("DELETE FROM mail_outbox WHERE to_email LIKE $1", [`${tag}-%`]);
    await pool().end();
  });

  it("delivers the mails it is scoped to, whatever is queued before them", async () => {
    const counts = await flushOutbox(db(), new Date(), settings, ok, { ids: [mine] });
    expect(counts).toEqual({ sent: 1, pending: 0, failed: 0 });
    expect(await query<{ status: string }>("SELECT status FROM mail_outbox WHERE id = $1", [mine])).toEqual([{ status: "sent" }]);
  });

  it("leaves the other files' mails alone", async () => {
    const others = await query<{ status: string }>("SELECT DISTINCT status FROM mail_outbox WHERE to_email LIKE $1", [`${tag}-other-%`]);
    expect(others).toEqual([{ status: "pending" }]);
  });
});
