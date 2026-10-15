import { z } from "zod";

/**
 * "Prepare my tax return" is assisted by an **Orazaka Studio** (krizaka/orazaka-packs) — Akinaza never calls a model.
 * The Studio receives the period's ledger (entries with their sources) and the expenses' receipts it may read, and
 * returns the return's figures, the working papers and its notes (an expense that looks personal, a receipt without a
 * QST number…). The ledger stays the authority: Akinaza reconciles the Studio's figures with its own, line by line, and
 * shows any difference; the merchant reviews and **files the return themselves** — nothing is transmitted.
 */
export const STUDIO = "tax-return-preparation";

const cents = z.number().int();
export const studioInput = z
  .object({
    shop: z.object({ legalName: z.string().min(1), gstNumber: z.string().nullable(), qstNumber: z.string().nullable() }),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    suppliesCents: cents,
    entries: z.array(z.object({ period: z.iso.date(), tax: z.enum(["gst", "qst"]), direction: z.enum(["collected", "credit"]), amountCents: cents, source: z.object({ kind: z.enum(["invoice", "expense"]), id: z.string(), label: z.string() }) })),
    receipts: z.array(z.object({ expenseId: z.string(), documentUrl: z.string().url() })).default([]),
    language: z.enum(["fr", "en"]),
  })
  .strict();

export const studioOutput = z.object({
  lines: z.array(z.object({ line: z.enum(["101", "103", "106", "109", "203", "206", "209"]), amountCents: cents })),
  workingPapers: z.array(z.object({ title: z.string(), body: z.string() })),
  notes: z.array(z.object({ severity: z.enum(["info", "review", "problem"]), text: z.string(), sourceId: z.string().optional() })),
});

export type StudioInput = z.input<typeof studioInput>;
export type StudioOutput = z.infer<typeof studioOutput>;

export interface StudioRun {
  runId: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  outputs: StudioOutput | null;
}

/** What the app needs from the Studio — the Orazaka client and the fake both implement it. */
export interface TaxStudio {
  start(input: StudioInput): Promise<StudioRun>;
  get(runId: string): Promise<StudioRun>;
}
