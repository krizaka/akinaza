import { query } from "./db";

export interface Overview {
  accounts: number;
  admins: number;
  suspended: number;
  shops: number;
  clients: number;
  appointmentsToday: number;
  invoices: number;
}

/** The administration's counts — metadata only, never a client's file or an invoice's content. */
export async function overview(): Promise<Overview> {
  const [row] = await query<Record<keyof Overview, string>>(
    `SELECT (SELECT count(*) FROM accounts) AS accounts,
            (SELECT count(*) FROM accounts WHERE role = 'ADMIN') AS admins,
            (SELECT count(*) FROM accounts WHERE status = 'SUSPENDED') AS suspended,
            (SELECT count(*) FROM shops) AS shops,
            (SELECT count(*) FROM clients WHERE erased_at IS NULL) AS clients,
            (SELECT count(*) FROM appointments WHERE lower(during)::date = current_date AND status <> 'cancelled') AS "appointmentsToday",
            (SELECT count(*) FROM invoices) AS invoices`,
  );
  const n = (k: keyof Overview) => Number(row?.[k] ?? 0);
  return { accounts: n("accounts"), admins: n("admins"), suspended: n("suspended"), shops: n("shops"), clients: n("clients"), appointmentsToday: n("appointmentsToday"), invoices: n("invoices") };
}
