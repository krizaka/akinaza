import { schema } from "@akinaza/db";
import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";

/** What a new invoice can bill: the shop's clients and its active services. */
export async function invoiceChoices(shopId: string) {
  const [clients, services] = await Promise.all([
    db().select({ id: schema.clients.id, fullName: schema.clients.fullName, language: schema.clients.language }).from(schema.clients).where(and(eq(schema.clients.shopId, shopId), isNull(schema.clients.erasedAt))).orderBy(asc(schema.clients.fullName)),
    db().select({ id: schema.services.id, nameFr: schema.services.nameFr, nameEn: schema.services.nameEn, priceCents: schema.services.priceCents, taxCategory: schema.services.taxCategory }).from(schema.services).where(and(eq(schema.services.shopId, shopId), eq(schema.services.active, true))).orderBy(asc(schema.services.nameEn)),
  ]);
  return { clients: clients.map((c) => ({ ...c, language: c.language === "en" ? ("en" as const) : ("fr" as const) })), services };
}
