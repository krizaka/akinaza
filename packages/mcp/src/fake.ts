import { prepareReturn } from "@akinaza/core";

import { type StudioInput, studioInput, type StudioRun, type TaxStudio } from "./contract";

/**
 * A Studio for tests and local work: it computes the figures with Akinaza's own code (so it agrees with the ledger), or
 * with a deliberate error (`skew`) to prove the reconciliation catches it, and flags expenses whose business share looks
 * personal (a receipt from a grocery chain, say).
 */
export class FakeTaxStudio implements TaxStudio {
  private readonly runs = new Map<string, StudioRun>();
  private next = 1;

  constructor(private readonly behaviour: { skew?: { line: string; byCents: number } } = {}) {}

  async start(input: StudioInput): Promise<StudioRun> {
    const valid = studioInput.parse(input);
    const ours = prepareReturn({ periodStart: valid.periodStart, periodEnd: valid.periodEnd, suppliesCents: valid.suppliesCents, entries: valid.entries });
    const lines = ours.lines.map((l) => ({ line: l.line as "101", amountCents: l.amountCents + (this.behaviour.skew?.line === l.line ? this.behaviour.skew.byCents : 0) }));
    const runId = `fake-run-${this.next++}`;
    const run: StudioRun = {
      runId,
      status: "succeeded",
      outputs: {
        lines,
        workingPapers: ours.lines.filter((l) => l.sources.length).map((l) => ({ title: `Line ${l.line}`, body: l.sources.map((s) => `${s.label}: ${s.amountCents}`).join("\n") })),
        notes: valid.entries.filter((e) => /iga|metro|maxi|provigo/i.test(e.source.label)).map((e) => ({ severity: "review" as const, text: `${e.source.label}: a grocery receipt — business use?`, sourceId: e.source.id })),
      },
    };
    this.runs.set(runId, run);
    return run;
  }

  async get(runId: string): Promise<StudioRun> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`unknown run ${runId}`);
    return run;
  }
}
