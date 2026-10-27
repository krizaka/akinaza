/**
 * Who owns each table (#247, the tenant isolation audit). Every table of the database is classified here, and `tenancy.test.ts` checks the
 * classification against the real catalogue: a table nobody classified fails the build, so a new table must say whose data it holds
 * BEFORE it ships.
 *
 *  - `shop`     carries `shop_id` (NOT NULL, a foreign key to shops, the leading column of an index): every query is scoped by it.
 *  - `child`    belongs to a shop through a parent row (`via`: the foreign-key column, `parent`: the table). Queries reach it only
 *               through the parent's shop (a join, or the parent's id taken after the shop check).
 *  - `scoped`   names its shop in a `scope_id` column (foreign key to shops): memberships and invitations of the roles package.
 *  - `root`     is the tenant itself (shops).
 *  - `account`  belongs to a person, not to a shop: their sessions, keys, endpoints, organisation (collections, tags).
 *  - `platform` is the platform's own (settings, audit, provider events, the mail outbox): reached by the administration or by a worker.
 */
export type TableOwnership =
  | { kind: "shop" }
  | { kind: "child"; via: string; parent: string }
  | { kind: "scoped"; column: string }
  | { kind: "root" }
  | { kind: "account"; via: string; parent: string }
  | { kind: "platform" };

const shop = { kind: "shop" } as const;
const child = (parent: string, via: string): TableOwnership => ({ kind: "child", parent, via });
const account = (parent: string, via: string): TableOwnership => ({ kind: "account", parent, via });
const platform = { kind: "platform" } as const;

export const TABLE_OWNERSHIP: Readonly<Record<string, TableOwnership>> = {
  // The tenant and its roles.
  shops: { kind: "root" },
  memberships: { kind: "scoped", column: "scope_id" },
  invitations: { kind: "scoped", column: "scope_id" },
  // Directly the shop's.
  appointments: shop,
  brief_actions: shop,
  brief_deliveries: shop,
  clients: shop,
  client_notes: shop,
  dependants: shop,
  expenses: shop,
  invoices: shop,
  services: shop,
  shop_former_slugs: shop,
  shop_media: shop,
  shop_page: shop,
  shop_figure_rules: shop,
  feed_tokens: shop,
  calendar_connections: shop,
  busy_intervals: shop,
  shop_page_versions: shop,
  shop_wall: shop,
  shop_wall_items: shop,
  shop_reels: shop,
  shop_social_links: shop,
  shop_reviews: shop,
  shop_announcements: shop,
  shop_languages: shop,
  shop_translations: shop,
  shop_translation_runs: shop,
  shop_rules: shop,
  shop_tags: shop,
  shop_zones: shop,
  staff: shop,
  tax_ledger: shop,
  // The shop's, through a parent.
  bookings: child("appointments", "appointment_id"),
  client_requests: child("clients", "client_id"),
  client_request_files: child("client_requests", "request_id"),
  days_off: child("staff", "staff_id"),
  schedules: child("staff", "staff_id"),
  invoice_deliveries: child("invoices", "invoice_id"),
  invoice_lines: child("invoices", "invoice_id"),
  payments: child("invoices", "invoice_id"),
  visit_reports: child("bookings", "booking_id"),
  // A person's.
  accounts: { kind: "account", parent: "accounts", via: "id" },
  sessions: account("accounts", "account_id"),
  password_resets: account("accounts", "account_id"),
  email_changes: account("accounts", "account_id"),
  api_keys: account("accounts", "owner_id"),
  webhook_endpoints: account("accounts", "owner_id"),
  webhook_deliveries: account("webhook_endpoints", "endpoint_id"),
  collections: account("accounts", "owner_id"),
  tags: account("accounts", "owner_id"),
  collections_tags: account("collections", "collection_id"),
  // The platform's.
  app_settings: platform,
  settings_audit: platform,
  price_versions: platform,
  audit_log: platform,
  payment_events: platform,
  webhook_received: platform,
  mail_outbox: platform,
  // The shared modules' own: which version of each is applied (@krizaka/db), and the privacy schema's tables live outside `public`.
  krizaka_module_versions: platform,
};
