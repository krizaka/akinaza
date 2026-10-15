import { type PreparedReturn, reconcile } from "@akinaza/core";

import type { StudioInput, StudioRun, TaxStudio } from "./contract";

export interface AssistedReturn {
  /** The figures Akinaza computed from its ledger — the ones shown and proposed to the merchant. */
  prepared: PreparedReturn;
  /** The Studio run (its id is the trace). */
  run: StudioRun;
  /** Every line where the Studio and the ledger disagree: shown to the merchant, never silently "fixed". */
  differences: { line: string; ours: number; theirs: number | null }[];
  notes: NonNullable<StudioRun["outputs"]>["notes"];
  /** The merchant validates and files; Akinaza transmits nothing. */
  merchantFiles: true;
}

/** Runs the Studio on the period and reconciles its figures with the ledger's. */
export async function assistReturn(studio: TaxStudio, prepared: PreparedReturn, input: StudioInput, opts: { pollMs?: number; maxPolls?: number } = {}): Promise<AssistedReturn> {
  let run = await studio.start(input);
  for (let i = 0; run.status === "running" && i < (opts.maxPolls ?? 30); i++) {
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 2000));
    run = await studio.get(run.runId);
  }
  const theirs = run.outputs?.lines ?? [];
  return { prepared, run, differences: run.status === "succeeded" ? reconcile(prepared, theirs) : [], notes: run.outputs?.notes ?? [], merchantFiles: true };
}
