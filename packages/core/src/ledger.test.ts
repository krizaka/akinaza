import { describe, expect, it } from "vitest";

import { balance, expenseEntries, invoiceEntries, type LedgerEntry } from "./ledger";
import { EXCLUDED_KINDS, posAllowed, SHOP_KINDS } from "./shop";
import { prepareReturn, reconcile } from "./tax-return";

const inv = (id: string, issuedOn: string, gstCents: number, qstCents: number) => invoiceEntries({ id, number: `F-${id}`, issuedOn, gstCents, qstCents });

describe("the tax ledger", () => {
  const entries: LedgerEntry[] = [
    ...inv("1", "2026-10-03", 500, 998),
    ...inv("2", "2026-10-20", 50, 100),
    ...inv("3", "2026-10-21", -50, -100), // a credit note cancels invoice 2
    ...expenseEntries({ id: "e1", supplier: "Fournisseur Beauté inc.", paidOn: "2026-10-05", gstCents: 120, qstCents: 239, businessSharePct: 100 }),
    ...expenseEntries({ id: "e2", supplier: "Vidéotron", paidOn: "2026-11-02", gstCents: 401, qstCents: 799, businessSharePct: 50 }),
  ];

  it("balances: collected − credits = net, for each tax, whatever the entries", () => {
    for (const tax of ["gst", "qst"] as const) {
      const b = balance(entries, tax);
      expect(b.net).toBe(b.collected - b.credits);
    }
    expect(balance(entries, "gst")).toEqual({ collected: 500, credits: 120 + 201, net: 179 });
    expect(balance(entries, "qst")).toEqual({ collected: 998, credits: 239 + 400, net: 359 });
  });

  it("posts nothing for a zero amount, and a credit note as negative entries", () => {
    expect(inv("4", "2026-10-01", 0, 0)).toEqual([]);
    expect(inv("3", "2026-10-21", -50, -100).every((e) => e.amountCents < 0 && e.direction === "collected")).toBe(true);
    expect(() => expenseEntries({ id: "x", supplier: "x", paidOn: "2026-10-01", gstCents: 1, qstCents: 1, businessSharePct: 101 })).toThrow();
  });

  it("prepares the return of a period with its working papers — and only prepares it", () => {
    const october = prepareReturn({ periodStart: "2026-10-01", periodEnd: "2026-10-31", suppliesCents: 11_000, entries });
    const line = (code: string) => october.lines.find((l) => l.line === code)!;
    expect(line("101").amountCents).toBe(11_000);
    expect(line("103")).toMatchObject({ amountCents: 500 });
    expect(line("103").sources.map((s) => s.label)).toEqual(["F-1", "F-2", "F-3"]);
    expect(line("106")).toMatchObject({ amountCents: 120, sources: [{ label: "Fournisseur Beauté inc.", amountCents: 120 }] });
    expect(line("109").amountCents).toBe(380);
    expect(line("209").amountCents).toBe(998 - 239);
    expect(october.preparedOnly).toBe(true);
    // November's expense stays in November.
    expect(prepareReturn({ periodStart: "2026-11-01", periodEnd: "2026-11-30", suppliesCents: 0, entries }).gstNetCents).toBe(-201);
  });

  it("reconciles another source's figures against the ledger, line by line", () => {
    const ours = prepareReturn({ periodStart: "2026-10-01", periodEnd: "2026-10-31", suppliesCents: 11_000, entries });
    const theirs = ours.lines.map((l) => ({ line: l.line, amountCents: l.line === "106" ? 121 : l.amountCents }));
    expect(reconcile(ours, theirs)).toEqual([{ line: "106", ours: 120, theirs: 121 }]);
    expect(reconcile(ours, ours.lines)).toEqual([]);
  });
});

describe("the point of sale gate", () => {
  it("never opens for a restaurant or a bar (SRM/MEV), and only behind its flag", () => {
    expect(posAllowed("restaurant", true)).toBe(false);
    expect(posAllowed("bar", true)).toBe(false);
    expect(posAllowed("salon", false)).toBe(false);
    expect(posAllowed("salon", true)).toBe(true);
  });

  it("serves service businesses only: no restaurant, café, bar or bakery (sales recording system, MEV-WEB)", () => {
    for (const kind of ["restaurant", "cafe", "bar", "bakery"]) {
      expect(SHOP_KINDS as readonly string[]).not.toContain(kind);
      expect(EXCLUDED_KINDS as readonly string[]).toContain(kind);
      expect(posAllowed(kind, true)).toBe(false);
    }
  });
});
