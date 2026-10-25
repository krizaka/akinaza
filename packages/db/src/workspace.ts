import { shopTypeOf } from "@akinaza/core";
import { type Actor, type AuditTrail, type Clock, createWorkspace, dbWorkspaceStore, filterSql, type KindConfig, type Query, type StatusSet, type Transaction, type ViewFilters, type WorkspaceDecl, workspaceMigration } from "@krizaka/organize";

import { INVOICE_STATUS_SET, KIND_DEFAULTS, presetVariant } from "./workspace-defaults";

export { workspaceMigration };

/**
 * « The workspace, organised » for Akinaza (krizaka-ts ADR-003, akinaza#337): the SHOP is the scope, so tags and saved views belong to
 * the shop (not to an account), and another shop's tag, view or entity id is a 404. Two kinds: the shop's clients and its invoices.
 *
 * An invoice's state is DERIVED from what was paid and what superseded it (`invoiceState` in @akinaza/core): `stateSql` is the same rule
 * in SQL so the list can filter on it — a test keeps both in step. There is no way to MOVE it: no « bulk paid » exists.
 */
export const WORKSPACE: WorkspaceDecl = {
  scope: "shops",
  users: "accounts",
  kinds: {
    client: { table: "clients", scopeColumn: "shop_id", dateColumn: "created_at", textColumns: ["full_name", "email"] },
    invoice: {
      table: "invoices",
      scopeColumn: "shop_id",
      dateColumn: "issued_on",
      textColumns: ["number"],
      // The day « today » is the shop's own calendar day, like `localDay(now, shop.timezone)` of the list.
      stateSql: `CASE
    WHEN e.credit_of IS NOT NULL THEN 'credit'
    WHEN EXISTS (SELECT 1 FROM invoices o WHERE o.credit_of = e.id OR o.replaces = e.id) THEN 'cancelled'
    WHEN COALESCE((SELECT sum(p.amount_cents) FROM payments p WHERE p.invoice_id = e.id), 0) >= e.total_cents THEN 'paid'
    WHEN e.due_on IS NOT NULL AND e.due_on < (now() AT TIME ZONE (SELECT s.timezone FROM shops s WHERE s.id = e.shop_id))::date THEN 'overdue'
    WHEN COALESCE((SELECT sum(p.amount_cents) FROM payments p WHERE p.invoice_id = e.id), 0) > 0 THEN 'partial'
    ELSE 'due'
  END`,
    },
  },
};

export const WORKSPACE_KINDS = ["client", "invoice"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];
export const isWorkspaceKind = (value: unknown): value is WorkspaceKind => (WORKSPACE_KINDS as readonly unknown[]).includes(value);

/** The status set of a kind (only the invoice has one, and it is derived). */
export const statusSetOf = (kind: WorkspaceKind): StatusSet | null => (kind === "invoice" ? INVOICE_STATUS_SET : null);

/** The trail, in the shop's `audit_log`: one line per entity, in the transaction of the change, with the shop in its detail. */
export const auditTrailOf = (shopId: string): AuditTrail => ({
  async record(query, entry) {
    await query("INSERT INTO audit_log (actor_id, actor_label, action, target_id, detail) VALUES ($1, $2, $3, $4, $5)", [
      entry.actorId,
      entry.actorLabel,
      entry.action,
      entry.target?.id ?? null,
      JSON.stringify({ ...entry.detail, shopId, ...(entry.target ? { targetType: entry.target.type } : {}) }),
    ]);
  },
});

export interface WorkspaceDeps {
  transaction: Transaction;
  clock: Clock;
}

/** The workspace layer over the app's transactions, its trail carrying the shop it speaks for. */
export const workspaceOf = (deps: WorkspaceDeps, shopId: string) =>
  createWorkspace({ transaction: deps.transaction, storeFor: (tx) => dbWorkspaceStore(tx, WORKSPACE), clock: deps.clock, audit: auditTrailOf(shopId) });

/** Who acts: the signed-in account, under its address, with its role in the shop. */
export const actorOf = (account: { id: string; email: string }, role: string): Actor => ({ id: account.id, label: account.email, role });

/**
 * The first time a shop uses the workspace: the administrator's defaults are written to the database (never overwriting), then the
 * shop receives its default tag set for its trade and the owner's language, once (`shops.organized_at`; a tag the owner deletes is not
 * brought back). Idempotent and cheap once done: one read.
 */
export async function ensureShopWorkspace(deps: WorkspaceDeps, shopId: string): Promise<void> {
  const [shop] = await deps.transaction((tx) =>
    tx<{ organized: boolean; business_type: "professional" | "pets"; shop_type: string | null; locale: string | null }>(
      `SELECT s.organized_at IS NOT NULL AS organized, s.business_type, p.shop_type, a.locale
         FROM shops s LEFT JOIN shop_page p ON p.shop_id = s.id LEFT JOIN accounts a ON a.id = s.owner_id WHERE s.id = $1`,
      [shopId],
    ),
  );
  if (!shop || shop.organized) return;
  const workspace = workspaceOf(deps, shopId);
  const trade = shopTypeOf(shop.business_type, shop.shop_type);
  const locale = shop.locale === "en" ? "en" : "fr";
  for (const defaults of KIND_DEFAULTS) {
    const { config } = await workspace.config.seed(defaults);
    await workspace.tags.seed(shopId, defaults.kind, presetVariant(trade, locale, (variant) => variant in config.tags.presets));
  }
  await deps.transaction((tx) => tx("UPDATE shops SET organized_at = $2 WHERE id = $1 AND organized_at IS NULL", [shopId, deps.clock.now()]));
}

/** What a list needs of a view: the ids of the shop's entities the filters keep (`null`: no filter, keep everything). */
export async function idsMatching(query: Query, kind: WorkspaceKind, shopId: string, filters: ViewFilters, status: StatusSet | null = statusSetOf(kind)): Promise<string[] | null> {
  const { sql, params } = filterSql(WORKSPACE, kind, filters, { from: 2, status });
  if (sql === "") return null;
  const table = WORKSPACE.kinds[kind]!.table;
  return (await query<{ id: string }>(`SELECT e.id FROM ${table} e WHERE e.shop_id = $1${sql}`, [shopId, ...params])).map((r) => r.id);
}

/** How many of the shop's entities wear each of its tags (the number on a binder divider). */
export async function tagCounts(query: Query, kind: WorkspaceKind, shopId: string): Promise<Map<string, number>> {
  const rows = await query<{ tag_id: string; n: number }>(
    `SELECT w.tag_id, count(*)::int AS n FROM organize.${kind}_tag w JOIN organize.tag t ON t.id = w.tag_id WHERE t.scope_id = $1 AND t.kind = $2 GROUP BY w.tag_id`,
    [shopId, kind],
  );
  return new Map(rows.map((r) => [r.tag_id, r.n]));
}

export type { KindConfig };
