import { createRoles, defineRoles } from "@krizaka/auth";

/**
 * The roles of a shop (#180), as data on `@krizaka/auth`'s role model: what each may do is this table, never an `if` on a role.
 *  - owner: everything — the shop's settings, billing, deletion, the team, and all the rest.
 *  - manager: bookings, clients, invoices, reports, the catalogue and the schedule, the team's staff; no settings, no billing, no deletion.
 *  - staff: their agenda, check-in and out, the visit reports and the access notes of their visits; no invoices, no reports, no clients' file.
 */
export const SHOP_PERMISSIONS = ["settings", "billing", "delete", "team", "catalogue", "schedule", "bookings", "clients", "invoices", "reports", "agenda", "checkin", "visit-reports", "access-notes"] as const;
export type ShopPermission = (typeof SHOP_PERMISSIONS)[number];

export const SHOP_ROLES = defineRoles({
  roles: ["owner", "manager", "staff"],
  permissions: {
    owner: SHOP_PERMISSIONS,
    manager: ["team", "catalogue", "schedule", "bookings", "clients", "invoices", "reports", "agenda", "checkin", "visit-reports", "access-notes"],
    staff: ["agenda", "checkin", "visit-reports", "access-notes"],
  },
  manages: { owner: ["owner", "manager", "staff"], manager: ["staff"], staff: [] },
});
export type ShopRole = (typeof SHOP_ROLES.roles)[number];

/** A SQL executor: the rows of a statement with its parameters (the app's pool, a test's client). */
export type RolesSql = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export const shopRolesOver = (query: RolesSql, hash: (token: string) => string) =>
  createRoles({ query: (sql, params) => query(sql, params) as never, model: SHOP_ROLES, tokenPrefix: "ai", tokenHash: hash, inviteTtlHours: 168 });
