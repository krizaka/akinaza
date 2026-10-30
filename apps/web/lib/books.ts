import type { PreparedReturn, ReturnLine } from "@akinaza/core";

/**
 * « Vos livres »: the combined GST/QST return (Revenu Québec's FPZ-500), prepared from the ledger for the merchant to
 * review and file themselves. Akinaza never transmits it. This module is the pure part: which period, and what the
 * screen says about the prepared figures.
 */
export interface Period {
  /** `2026-Q3` or `2026-02`: the address's `?period=`. */
  id: string;
  start: string;
  end: string;
  kind: "quarter" | "month";
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const quarter = (year: number, q: number): Period => ({ id: `${year}-Q${q}`, start: `${year}-${pad(q * 3 - 2)}-01`, end: `${year}-${pad(q * 3)}-${lastDay(year, q * 3)}`, kind: "quarter" });

/** The last four quarters, the latest completed one first (today's quarter is still open: nothing to file yet). */
export function periodChoices(today: string): Period[] {
  let year = Number(today.slice(0, 4));
  let q = Math.ceil(Number(today.slice(5, 7)) / 3) - 1;
  if (q === 0) {
    year -= 1;
    q = 4;
  }
  const out: Period[] = [];
  for (let i = 0; i < 4; i++) {
    out.push(quarter(year, q));
    q -= 1;
    if (q === 0) {
      year -= 1;
      q = 4;
    }
  }
  return out;
}

/** The period asked for in the address; anything that is not a quarter (`2026-Q3`) or a month (`2026-02`) is the default. */
export function periodFor(param: string | undefined, today: string): Period {
  const fallback = periodChoices(today)[0]!;
  const q = /^(\d{4})-Q([1-4])$/.exec(param ?? "");
  if (q) return quarter(Number(q[1]), Number(q[2]));
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(param ?? "");
  if (m) return { id: param!, start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${lastDay(Number(m[1]), Number(m[2]))}`, kind: "month" };
  return fallback;
}

export type Outcome = "remit" | "claim" | "zero";
const outcome = (net: number): Outcome => {
  if (net > 0) return "remit";
  return net < 0 ? "claim" : "zero";
};

export interface BooksView {
  lines: (ReturnLine & { computed: boolean })[];
  gst: { netCents: number; outcome: Outcome };
  qst: { netCents: number; outcome: Outcome };
  /** Always true: the merchant files. */
  preparedOnly: true;
}

/** The lines 101 is a total, 109 and 209 are computed from the lines above them; the others come from ledger entries. */
export function booksView(prepared: PreparedReturn): BooksView {
  return {
    lines: prepared.lines.map((l) => ({ ...l, computed: l.line === "101" || l.line === "109" || l.line === "209" })),
    gst: { netCents: Math.abs(prepared.gstNetCents), outcome: outcome(prepared.gstNetCents) },
    qst: { netCents: Math.abs(prepared.qstNetCents), outcome: outcome(prepared.qstNetCents) },
    preparedOnly: true,
  };
}

/** A period with nothing in it: no line carries an amount or a document, so the page says so instead of showing a table of zeros. */
export function booksIsEmpty(view: { lines: Pick<ReturnLine, "line" | "amountCents" | "sources">[] }): boolean {
  return view.lines.every((l) => l.amountCents === 0 && l.sources.length === 0);
}
