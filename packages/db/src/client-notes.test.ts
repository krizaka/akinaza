import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addClientNote, clientNotes } from "./client-notes";
import { clientFile, clientOverview } from "./client-files";
import { recordPayment } from "./invoice-payments";
import { eraseClient, issueShopInvoice } from "./shop-ops";
import { freshDatabase, refusal } from "./test/db";
import { account, salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("a client's notes (D5): signed, dated, the shop's own (real PostgreSQL 16)", () => {
  it("keeps a note with its author's name and its date, newest first", async () => {
    const s = await salon(t.db);
    const eric = await account(t.db, "eric-notes@example.test");
    await addClientNote(t.db, s.shop.id, s.client.id, { accountId: eric.id, name: "Éric" }, "  Préfère les rendez-vous le matin.  ", new Date("2026-10-20T14:00:00Z"));
    await addClientNote(t.db, s.shop.id, s.client.id, { accountId: eric.id, name: "Éric" }, "Facture au nom de l'entreprise.", new Date("2026-10-22T14:00:00Z"));
    const notes = await clientNotes(t.db, s.shop.id, s.client.id);
    expect(notes.map((n) => [n.body, n.author])).toEqual([
      ["Facture au nom de l'entreprise.", "Éric"],
      ["Préfère les rendez-vous le matin.", "Éric"],
    ]);
    expect(notes[0]!.createdAt).toBe("2026-10-22T14:00:00.000Z");
  });

  it("refuses a note on another shop's client, and an empty one", async () => {
    const s = await salon(t.db);
    const other = await salon(t.db);
    const eric = await account(t.db, "eric-notes2@example.test");
    expect(await refusal(addClientNote(t.db, s.shop.id, other.client.id, { accountId: eric.id, name: "Éric" }, "x", new Date()))).toMatch(/AK_CLIENT_UNKNOWN/);
    expect(await clientNotes(t.db, s.shop.id, other.client.id)).toEqual([]);
    expect(await refusal(addClientNote(t.db, s.shop.id, s.client.id, { accountId: eric.id, name: "Éric" }, "   ", new Date()))).toMatch(/AK_NOTE_EMPTY/);
  });

  it("forgets the notes when the client is erased (Loi 25)", async () => {
    const s = await salon(t.db);
    const eric = await account(t.db, "eric-notes3@example.test");
    await addClientNote(t.db, s.shop.id, s.client.id, { accountId: eric.id, name: "Éric" }, "Allergique au latex.", new Date());
    await eraseClient(t.db, s.client.id, "v1");
    expect(await clientNotes(t.db, s.shop.id, s.client.id)).toEqual([]);
  });
});

describe("the Clients plan strip and an invoice's state on the file (D5)", () => {
  it("gives each client what they still owe, and the file each invoice's paid amount and due date", async () => {
    const s = await salon(t.db);
    const { invoice } = await issueShopInvoice(t.db, s.shop.id, { clientId: s.client.id, language: "fr", issuedOn: "2026-10-19", termsDays: 0, lines: [{ serviceId: s.services.cut.id, quantity: 1 }] });
    await recordPayment(t.db, s.shop.id, invoice.id, { method: "cash", amountCents: 2_000 }, new Date("2026-10-20T15:00:00Z"));
    const [row] = await clientOverview(t.db, s.shop.id, new Date("2026-10-23T12:00:00Z"));
    expect(row).toMatchObject({ id: s.client.id, owedCents: 3_174 });
    const file = await clientFile(t.db, s.shop.id, s.client.id);
    expect(file!.invoices[0]).toMatchObject({ id: invoice.id, paidCents: 2_000, dueOn: "2026-10-19", superseded: false });
  });
});
