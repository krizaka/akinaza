import { INVOICE_STATE, invoiceState } from "@akinaza/core";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import type { Db } from "./client";
import { appointments, clients, invoices, shops, staff } from "./schema";
import { listInvoices } from "./shop-ops";

// @fixed: the palette shows a handful of each kind; « see all » is the list itself
const PER_KIND = 5;

/** `%` and `_` typed by the person are themselves, never a pattern. */
const contains = (q: string) => {
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
};

export interface ShopSearchResult {
  clients: { id: string; fullName: string }[];
  invoices: { id: string; number: string; client: string | null }[];
}

/**
 * What the palette (⌘K) finds in one shop: its client files by a part of their name (erased ones never), its invoices by their
 * number or their client's name, newest first. Every row is the shop's own: the shop id is the guard's, never the request's.
 */
export async function searchShop(db: Db, shopId: string, query: string): Promise<ShopSearchResult> {
  const q = query.trim();
  if (!q) return { clients: [], invoices: [] };
  const like = contains(q);
  const [files, bills] = await Promise.all([
    db.select({ id: clients.id, fullName: clients.fullName }).from(clients).where(and(eq(clients.shopId, shopId), isNull(clients.erasedAt), ilike(clients.fullName, like))).orderBy(clients.fullName).limit(PER_KIND),
    db
      .select({ id: invoices.id, number: invoices.number, client: clients.fullName })
      .from(invoices)
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(eq(invoices.shopId, shopId), or(ilike(invoices.number, like), ilike(clients.fullName, like))))
      .orderBy(desc(invoices.createdAt), desc(invoices.number))
      .limit(PER_KIND),
  ]);
  return { clients: files, invoices: bills };
}

const OWED: ReadonlySet<string> = new Set([INVOICE_STATE.due, INVOICE_STATE.partial, INVOICE_STATE.overdue]);

/**
 * The rail's counts: the appointments of `day` (the shop's calendar day; a staff member's own when `staffAccountId` is given),
 * cancelled ones aside, and the invoices still to collect — due, partly paid or overdue, from `invoiceState`, the list's rule.
 */
export async function frameCounts(db: Db, shopId: string, scope: { day: string; staffAccountId?: string }): Promise<{ appointments: number; toCollect: number }> {
  const [[day], bills] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .innerJoin(shops, eq(shops.id, appointments.shopId))
      .where(
        and(
          eq(appointments.shopId, shopId),
          sql`${appointments.status} <> 'cancelled'`,
          sql`(lower(${appointments.during}) AT TIME ZONE ${shops.timezone})::date = ${scope.day}::date`,
          scope.staffAccountId ? sql`${appointments.staffId} IN (SELECT ${staff.id} FROM ${staff} WHERE ${staff.accountId} = ${scope.staffAccountId})` : undefined,
        ),
      ),
    listInvoices(db, shopId),
  ]);
  const toCollect = bills.filter((i) => OWED.has(invoiceState({ totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: i.creditOf !== null, superseded: i.superseded }, scope.day))).length;
  return { appointments: day?.n ?? 0, toCollect };
}
