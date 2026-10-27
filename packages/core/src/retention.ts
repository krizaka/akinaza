/**
 * How long each kind of record is kept, as data (Loi 25, P-39.1 art. 23: personal information is destroyed or anonymised once its purposes
 * are achieved, subject to a retention period the law sets; akinaza#370). The privacy erasure reads it: a record whose `keep` is `tax`
 * survives the erasure of the person it names, with the personal fields blanked; everything else goes.
 */

// @fixed: the tax law's period: six years after the end of the year a record relates to (Tax Administration Act, CQLR c. A-6.002, art. 35; Income Tax Act, s. 230(4); Excise Tax Act, s. 286).
export const TAX_RETENTION_YEARS = 6;

export const RETENTION_KEEP = { tax: "tax", request: "request", period: "period" } as const;
export type RetentionKeep = (typeof RETENTION_KEEP)[keyof typeof RETENTION_KEEP];

export interface RetentionRule {
  /** A stable name, the key of the rule in the docs and in the tests. */
  id: string;
  /** The tables that hold this kind of record. */
  tables: readonly string[];
  /**
   * `tax`: kept for the tax period, then destroyed; `request`: destroyed when the person or the shop asks (an erasure removes it);
   * `period`: destroyed after the period the shop sets (a setting), or at the shop's request.
   */
  keep: RetentionKeep;
  /** What an erasure does to it. */
  onErasure: "kept-anonymised" | "removed" | "blanked";
  /** The law behind a `tax` rule, by name and article (never the text). */
  basis?: readonly string[];
}

export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    id: "invoices",
    tables: ["invoices", "invoice_lines", "payments"],
    keep: RETENTION_KEEP.tax,
    onErasure: "kept-anonymised",
    basis: ["Tax Administration Act, CQLR c. A-6.002, art. 35", "Income Tax Act, R.S.C. 1985, c. 1 (5th Supp.), s. 230(4)", "Excise Tax Act, R.S.C. 1985, c. E-15, s. 286"],
  },
  {
    id: "tax-ledger",
    tables: ["tax_ledger"],
    keep: RETENTION_KEEP.tax,
    onErasure: "kept-anonymised",
    basis: ["Tax Administration Act, CQLR c. A-6.002, art. 35", "Excise Tax Act, R.S.C. 1985, c. E-15, s. 286"],
  },
  { id: "client-file", tables: ["clients", "dependants", "client_notes"], keep: RETENTION_KEEP.request, onErasure: "blanked" },
  { id: "visit-reports", tables: ["visit_reports", "mail_outbox"], keep: RETENTION_KEEP.request, onErasure: "removed" },
  { id: "client-requests", tables: ["client_requests", "client_request_files"], keep: RETENTION_KEEP.request, onErasure: "removed" },
  { id: "reviews", tables: ["shop_reviews"], keep: RETENTION_KEEP.request, onErasure: "blanked" },
  { id: "appointments", tables: ["appointments", "bookings"], keep: RETENTION_KEEP.period, onErasure: "kept-anonymised" },
  { id: "consents", tables: ["privacy.consent", "privacy.request"], keep: RETENTION_KEEP.period, onErasure: "kept-anonymised" },
];

/** The rule that holds a table, or undefined when no rule names it. */
export function retentionOf(table: string): RetentionRule | undefined {
  return RETENTION_RULES.find((rule) => rule.tables.includes(table));
}

/** The last day a tax record must be kept: the end of the sixth year after the year it relates to (`YYYY-MM-DD` in, `YYYY-12-31` out). */
export function taxRetentionEnd(day: string): string {
  const year = Number(day.slice(0, 4));
  if (!Number.isInteger(year) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError(`a day is YYYY-MM-DD, got « ${day} »`);
  return `${year + TAX_RETENTION_YEARS}-12-31`;
}
