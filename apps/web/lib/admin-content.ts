import { query } from "./db";

/** What the console reads of Akinaza's own objects: shops, invoices and the checks of the tax ledger. Metadata and cents only: never a client's file or an invoice line. */

export interface AdminShop {
  id: string;
  name: string;
  legalName: string;
  kind: string;
  registrant: boolean;
  owner: string | null;
  clients: number;
  invoices: number;
  lastInvoiceOn: string | null;
  createdAt: string;
}

export async function shopsOverview(): Promise<AdminShop[]> {
  const rows = await query<{ id: string; name: string; legal_name: string; kind: string; registrant: boolean; owner: string | null; clients: string; invoices: string; last_invoice: string | null; created_at: Date }>(
    `SELECT s.id, s.name, s.legal_name, s.kind, s.registrant, a.email AS owner, s.created_at,
            (SELECT count(*) FROM clients c WHERE c.shop_id = s.id AND c.erased_at IS NULL) AS clients,
            (SELECT count(*) FROM invoices i WHERE i.shop_id = s.id) AS invoices,
            (SELECT max(i.issued_on)::text FROM invoices i WHERE i.shop_id = s.id) AS last_invoice
       FROM shops s LEFT JOIN accounts a ON a.id = s.owner_id ORDER BY s.created_at DESC LIMIT 500`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, legalName: r.legal_name, kind: r.kind, registrant: r.registrant, owner: r.owner, clients: Number(r.clients), invoices: Number(r.invoices), lastInvoiceOn: r.last_invoice, createdAt: r.created_at.toISOString() }));
}

export interface AdminInvoice {
  id: string;
  shop: string;
  number: string;
  issuedOn: string;
  isCredit: boolean;
  subtotalCents: number;
  gstCents: number;
  qstCents: number;
  totalCents: number;
  /** What the ledger holds for this invoice, per tax: the two must equal the invoice's own. */
  ledgerGstCents: number;
  ledgerQstCents: number;
  ledgerOk: boolean;
}

/** An invoice agrees with the ledger when the GST and QST entries posted for it equal its own taxes. Pure, tested. */
export const ledgerAgrees = (invoice: { gstCents: number; qstCents: number }, ledger: { gstCents: number; qstCents: number }) => invoice.gstCents === ledger.gstCents && invoice.qstCents === ledger.qstCents;

export async function invoicesOverview(limit = 500): Promise<AdminInvoice[]> {
  const rows = await query<{ id: string; shop: string; number: string; issued_on: string; credit_of: string | null; subtotal_cents: number; gst_cents: number; qst_cents: number; total_cents: number; l_gst: string; l_qst: string }>(
    `SELECT i.id, s.name AS shop, i.number, i.issued_on::text, i.credit_of, i.subtotal_cents, i.gst_cents, i.qst_cents, i.total_cents,
            coalesce((SELECT sum(l.amount_cents) FROM tax_ledger l WHERE l.source_kind = 'invoice' AND l.source_id = i.id AND l.tax = 'gst'), 0) AS l_gst,
            coalesce((SELECT sum(l.amount_cents) FROM tax_ledger l WHERE l.source_kind = 'invoice' AND l.source_id = i.id AND l.tax = 'qst'), 0) AS l_qst
       FROM invoices i JOIN shops s ON s.id = i.shop_id ORDER BY i.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => {
    const ledger = { gstCents: Number(r.l_gst), qstCents: Number(r.l_qst) };
    return { id: r.id, shop: r.shop, number: r.number, issuedOn: r.issued_on, isCredit: r.credit_of !== null, subtotalCents: r.subtotal_cents, gstCents: r.gst_cents, qstCents: r.qst_cents, totalCents: r.total_cents, ledgerGstCents: ledger.gstCents, ledgerQstCents: ledger.qstCents, ledgerOk: ledgerAgrees({ gstCents: r.gst_cents, qstCents: r.qst_cents }, ledger) };
  });
}

export interface LedgerCheck {
  shop: string;
  period: string;
  gstCollectedCents: number;
  qstCollectedCents: number;
  /** The same totals recomputed from the invoices of the period: the two must be equal. */
  gstInvoicesCents: number;
  qstInvoicesCents: number;
  ok: boolean;
}

/** Per shop and month: the ledger's collected GST/QST against the invoices' own. A difference is shown, never adopted. */
export async function ledgerChecks(): Promise<LedgerCheck[]> {
  const rows = await query<{ shop: string; period: string; l_gst: string; l_qst: string; i_gst: string; i_qst: string }>(
    `WITH ledger AS (
       SELECT shop_id, period, sum(amount_cents) FILTER (WHERE tax = 'gst' AND direction = 'collected') AS gst, sum(amount_cents) FILTER (WHERE tax = 'qst' AND direction = 'collected') AS qst
         FROM tax_ledger GROUP BY shop_id, period),
     inv AS (
       SELECT shop_id, date_trunc('month', issued_on)::date AS period, sum(gst_cents) AS gst, sum(qst_cents) AS qst FROM invoices GROUP BY shop_id, date_trunc('month', issued_on))
     SELECT s.name AS shop, coalesce(l.period, i.period)::text AS period,
            coalesce(l.gst, 0) AS l_gst, coalesce(l.qst, 0) AS l_qst, coalesce(i.gst, 0) AS i_gst, coalesce(i.qst, 0) AS i_qst
       FROM ledger l FULL JOIN inv i ON i.shop_id = l.shop_id AND i.period = l.period JOIN shops s ON s.id = coalesce(l.shop_id, i.shop_id)
      ORDER BY 2 DESC, 1 LIMIT 500`,
  );
  return rows.map((r) => ({ shop: r.shop, period: r.period, gstCollectedCents: Number(r.l_gst), qstCollectedCents: Number(r.l_qst), gstInvoicesCents: Number(r.i_gst), qstInvoicesCents: Number(r.i_qst), ok: Number(r.l_gst) === Number(r.i_gst) && Number(r.l_qst) === Number(r.i_qst) }));
}

export interface Operations {
  pool: { max: number; total: number; idle: number; waiting: number };
  connections: { open: number; limit: number };
  /** Invoices whose ledger entries differ from their taxes, and months where the ledger differs from the invoices: both must be 0. */
  invoiceMismatches: number;
  monthMismatches: number;
  shopsWithoutTaxNumbers: number;
  refusedSignIns24h: number;
}
