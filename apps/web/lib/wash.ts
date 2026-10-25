/**
 * « A changed row washes once » (D11, @krizaka/ui motion.css): between two reads of a page, the rows whose content changed — a
 * payment recorded, a visit started, a row someone else added — and only those. The first read is the page's arrival: nothing
 * washes. Pure: the component keeps the previous signatures and marks the rows it returns with `data-kz-arrive`.
 */
export type Signatures = ReadonlyMap<string, string>;

export const signaturesOf = <T>(rows: readonly T[], key: (row: T) => string, signature: (row: T) => string): Signatures => new Map(rows.map((row) => [key(row), signature(row)]));

export function changedKeys<T>(before: Signatures | null, rows: readonly T[], key: (row: T) => string, signature: (row: T) => string): Set<string> {
  if (before === null) return new Set();
  return new Set(rows.filter((row) => before.get(key(row)) !== signature(row)).map(key));
}
