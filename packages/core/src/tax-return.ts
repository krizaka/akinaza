import { balance, type LedgerEntry, type Tax } from "./ledger";
import type { Cents } from "./money";

/**
 * "Prepare my tax return": the figures of the combined GST/QST return (Revenu Québec's form FPZ-500 — Revenu Québec
 * administers both taxes for most Québec businesses), computed from the ledger, with the working papers that show
 * where each figure comes from. Akinaza **prepares**; the merchant reviews and files the return themselves. Nothing
 * here transmits anything to anyone.
 */
export interface ReturnLine {
  /** The line of the form (FPZ-500: 101 supplies; GST 103 collected, 106 ITC, 109 net; QST 203 collected, 206 ITR, 209 net). */
  line: string;
  amountCents: Cents;
  /** The ledger entries behind the figure — the working paper. */
  sources: { kind: "invoice" | "expense"; id: string; label: string; amountCents: Cents }[];
}

export interface PreparedReturn {
  periodStart: string;
  periodEnd: string;
  lines: ReturnLine[];
  gstNetCents: Cents;
  qstNetCents: Cents;
  /** Always true: the merchant files. */
  preparedOnly: true;
}

const months = (start: string, end: string) => (e: LedgerEntry) => e.period >= `${start.slice(0, 7)}-01` && e.period <= `${end.slice(0, 7)}-01`;

export function prepareReturn(input: { periodStart: string; periodEnd: string; suppliesCents: Cents; entries: readonly LedgerEntry[] }): PreparedReturn {
  const inPeriod = input.entries.filter(months(input.periodStart, input.periodEnd));
  const line = (code: string, tax: Tax, direction: "collected" | "credit"): ReturnLine => {
    const picked = inPeriod.filter((e) => e.tax === tax && e.direction === direction);
    return { line: code, amountCents: picked.reduce((s, e) => s + e.amountCents, 0), sources: picked.map((e) => ({ ...e.source, amountCents: e.amountCents })) };
  };
  const gst = balance(inPeriod, "gst");
  const qst = balance(inPeriod, "qst");
  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    lines: [
      { line: "101", amountCents: input.suppliesCents, sources: [] },
      line("103", "gst", "collected"),
      line("106", "gst", "credit"),
      { line: "109", amountCents: gst.net, sources: [] },
      line("203", "qst", "collected"),
      line("206", "qst", "credit"),
      { line: "209", amountCents: qst.net, sources: [] },
    ],
    gstNetCents: gst.net,
    qstNetCents: qst.net,
    preparedOnly: true,
  };
}

/** Compares figures (an Orazaka Studio's, say) with the ledger's: every line that differs, by how much. */
export function reconcile(ours: PreparedReturn, theirs: { line: string; amountCents: Cents }[]): { line: string; ours: Cents; theirs: Cents | null }[] {
  return ours.lines
    .map((l) => ({ line: l.line, ours: l.amountCents, theirs: theirs.find((t) => t.line === l.line)?.amountCents ?? null }))
    .filter((d) => d.theirs !== d.ours);
}
