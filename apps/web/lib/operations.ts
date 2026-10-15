import { invoicesOverview, ledgerChecks, type Operations } from "./admin-content";
import { pool, query } from "./db";
import { budgetLimit } from "./operations-shared";

/** What an operator reads to know whether the service is well: the pool and connections against their budget, and whether the ledger still agrees with the invoices. */
export async function operations(): Promise<Operations> {
  const p = pool();
  const [budget] = await query<{ open: string; role_limit: number; server_limit: string }>(
    `SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS open,
            (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS role_limit,
            current_setting('max_connections') AS server_limit`,
  );
  const [shops] = await query<{ n: string }>("SELECT count(*) AS n FROM shops WHERE registrant AND (coalesce(gst_number, '') = '' OR coalesce(qst_number, '') = '')");
  const [refused] = await query<{ n: string }>("SELECT count(*) AS n FROM audit_log WHERE action = 'auth.sign_in_refused' AND at > now() - interval '24 hours'");
  const [invoices, months] = await Promise.all([invoicesOverview(5000), ledgerChecks()]);
  return {
    pool: { max: p.options.max ?? 10, total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount },
    connections: { open: Number(budget?.open ?? 0), limit: budgetLimit(Number(budget?.role_limit ?? -1), Number(budget?.server_limit ?? 0)) },
    invoiceMismatches: invoices.filter((i) => !i.ledgerOk).length,
    monthMismatches: months.filter((m) => !m.ok).length,
    shopsWithoutTaxNumbers: Number(shops?.n ?? 0),
    refusedSignIns24h: Number(refused?.n ?? 0),
  };
}
