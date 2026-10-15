import { invoiceEntries, expenseEntries, prepareReturn } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { assistReturn, FakeTaxStudio, orazakaTaxStudio, STUDIO, type StudioInput } from "./index";

const entries = [
  ...invoiceEntries({ id: "i1", number: "F-00001", issuedOn: "2026-10-03", gstCents: 700, qstCents: 1_397 }),
  ...expenseEntries({ id: "e1", supplier: "Fournisseur Beauté inc.", paidOn: "2026-10-05", gstCents: 120, qstCents: 239, businessSharePct: 100 }),
  ...expenseEntries({ id: "e2", supplier: "IGA Laurier", paidOn: "2026-10-06", gstCents: 0, qstCents: 50, businessSharePct: 100 }),
];
const input: StudioInput = { shop: { legalName: "Salon Laurier inc.", gstNumber: "123456789RT0001", qstNumber: "1234567890TQ0001" }, periodStart: "2026-10-01", periodEnd: "2026-10-31", suppliesCents: 14_000, entries, language: "fr" };
const prepared = prepareReturn({ periodStart: "2026-10-01", periodEnd: "2026-10-31", suppliesCents: 14_000, entries });

describe("the tax-assistant Studio contract", () => {
  it("agrees with the ledger when the Studio is right, and passes on its notes for the merchant to review", async () => {
    const r = await assistReturn(new FakeTaxStudio(), prepared, input);
    expect(r.differences).toEqual([]);
    expect(r.run.runId).toMatch(/^fake-run-/);
    expect(r.notes).toEqual([{ severity: "review", text: "IGA Laurier: a grocery receipt — business use?", sourceId: "e2" }]);
    expect(r.merchantFiles).toBe(true);
  });

  it("shows any figure the Studio got wrong — the ledger stays the authority", async () => {
    const r = await assistReturn(new FakeTaxStudio({ skew: { line: "106", byCents: 1 } }), prepared, input);
    expect(r.differences).toEqual([{ line: "106", ours: 120, theirs: 121 }]);
    expect(r.prepared.lines.find((l) => l.line === "106")!.amountCents).toBe(120);
  });

  it("starts a run on Orazaka's edge with the service key, then reads it until it succeeds", async () => {
    const calls: string[] = [];
    let polls = 0;
    const studio = orazakaTaxStudio({
      baseUrl: "https://dev.orazaka.com/edge",
      apiKey: "oz_test",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push(`${init.method} ${url}`);
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer oz_test");
        if (init.method === "POST") return Response.json({ id: "run-42", status: "RUNNING" }, { status: 202 });
        polls++;
        return Response.json({ id: "run-42", status: polls < 2 ? "RUNNING" : "SUCCEEDED", outputs: { lines: prepared.lines.map((l) => ({ line: l.line, amountCents: l.amountCents })), workingPapers: [], notes: [] } });
      }) as typeof fetch,
    });
    const r = await assistReturn(studio, prepared, input, { pollMs: 1 });
    expect(r.run).toMatchObject({ runId: "run-42", status: "succeeded" });
    expect(r.differences).toEqual([]);
    expect(calls[0]).toBe(`POST https://dev.orazaka.com/edge/api/v1/studios/${STUDIO}/runs`);
    expect(calls.at(-1)).toBe("GET https://dev.orazaka.com/edge/api/v1/studios/runs/run-42");
  });

  it("refuses outputs outside the contract, a missing key, and maps refusals to stable codes", async () => {
    const bad = orazakaTaxStudio({ baseUrl: "https://x", apiKey: "oz_k", fetch: (async () => Response.json({ id: "r", status: "SUCCEEDED", outputs: { lines: [{ line: "999", amountCents: 1.5 }] } })) as unknown as typeof fetch });
    await expect(bad.get("r")).rejects.toMatchObject({ code: "STUDIO_SHAPE" });
    await expect(orazakaTaxStudio({ baseUrl: "https://x", apiKey: undefined }).get("r")).rejects.toMatchObject({ code: "STUDIO_NOT_CONFIGURED" });
    const broke = orazakaTaxStudio({ baseUrl: "https://x", apiKey: "oz_k", fetch: (async () => new Response("", { status: 402 })) as unknown as typeof fetch });
    await expect(broke.start(input)).rejects.toMatchObject({ code: "STUDIO_CREDITS" });
  });

  it("never transmits a return: the contract has no filing call", () => {
    expect(Object.keys(orazakaTaxStudio({ baseUrl: "https://x", apiKey: "oz_k" })).sort()).toEqual(["get", "start"]);
  });
});
