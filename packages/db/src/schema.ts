import { sql } from "drizzle-orm";
import { bigserial, boolean, check, customType, date, index, integer, jsonb, pgTable, smallint, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Akinaza's schema. Money is `integer` cents — never `numeric` read as a float, never `real`. What the database itself
 * guarantees (drizzle/0001_rules.sql): no member of the staff is booked twice at once; an issued invoice never changes;
 * the ledger is append-only and every invoice's ledger entries equal its taxes at commit; a shop is never a restaurant or
 * a bar; a registered shop has well-formed GST and QST numbers.
 */

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
/** A PostgreSQL `tstzrange` — an appointment's time, so overlaps are the database's business (EXCLUDE). */
const tstzrange = customType<{ data: string }>({ dataType: () => "tstzrange" });

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    email: text("email").notNull().unique(),
    role: text("role", { enum: ["USER", "ADMIN"] }).notNull().default("USER"),
    status: text("status", { enum: ["ACTIVE", "SUSPENDED"] }).notNull().default("ACTIVE"),
    locale: text("locale", { enum: ["en", "fr"] }).notNull().default("fr"),
    passwordHash: text("password_hash"),
    createdAt: created(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [check("accounts_email_lower", sql`${t.email} = lower(${t.email})`), check("accounts_role", sql`${t.role} IN ('USER','ADMIN')`), check("accounts_status", sql`${t.status} IN ('ACTIVE','SUSPENDED')`), check("accounts_locale", sql`${t.locale} IN ('en','fr')`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: created(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_account").on(t.accountId)],
);

/** A password reset link, kept as its hash: one use, 30 minutes. */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: id(),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: created(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("password_resets_account").on(t.accountId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid("actor_id"),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    detail: jsonb("detail").notNull().default({}),
    ip: text("ip"),
  },
  (t) => [index("audit_log_at").on(t.at)],
);

export const shops = pgTable(
  "shops",
  {
    id: id(),
    ownerId: uuid("owner_id").references(() => accounts.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    legalName: text("legal_name").notNull(),
    kind: text("kind", { enum: ["salon", "bakery", "cafe", "boutique", "services", "other"] }).notNull(),
    /** Registered for the GST and the QST (a small supplier under $30 000 is not). */
    registrant: boolean("registrant").notNull().default(true),
    gstNumber: text("gst_number"),
    qstNumber: text("qst_number"),
    address: text("address").notNull(),
    timezone: text("timezone").notNull().default("America/Toronto"),
    invoicePrefix: text("invoice_prefix").notNull().default("F"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    createdAt: created(),
  },
  (t) => [
    check("shops_kind", sql`${t.kind} IN ('salon','bakery','cafe','boutique','services','other')`),
    check("shops_tax_numbers", sql`NOT ${t.registrant} OR (coalesce(${t.gstNumber}, '') ~ '^[0-9]{9}RT[0-9]{4}$' AND coalesce(${t.qstNumber}, '') ~ '^[0-9]{10}TQ[0-9]{4}$')`),
  ],
);

export const staff = pgTable("staff", {
  id: id(),
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
});

export const services = pgTable(
  "services",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    nameFr: text("name_fr").notNull(),
    nameEn: text("name_en").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    taxCategory: text("tax_category", { enum: ["standard", "zeroRated", "exempt"] }).notNull().default("standard"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [check("services_duration", sql`${t.durationMinutes} BETWEEN 5 AND 600`), check("services_price", sql`${t.priceCents} >= 0`), check("services_tax_category", sql`${t.taxCategory} IN ('standard','zeroRated','exempt')`)],
);

/** A staff member's weekly hours (0 = Sunday … 6 = Saturday), in the shop's time zone. */
export const schedules = pgTable(
  "schedules",
  {
    id: id(),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
  },
  (t) => [check("schedules_weekday", sql`${t.weekday} BETWEEN 0 AND 6`), check("schedules_hours", sql`${t.endsAt} > ${t.startsAt}`)],
);

/**
 * A client file (Loi 25): what the shop needs, nothing more. Erasure keeps the row (invoices point to it, and must be
 * kept six years) but blanks every personal field and stamps `erased_at`.
 */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    language: text("language", { enum: ["fr", "en"] }).notNull().default("fr"),
    createdAt: created(),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
  },
  (t) => [index("clients_shop").on(t.shopId), check("clients_erased", sql`${t.erasedAt} IS NULL OR (${t.email} IS NULL AND ${t.phone} IS NULL AND ${t.notes} IS NULL)`)],
);

/** Every consent decision, per purpose and text version — append-only (trigger). */
export const clientConsents = pgTable(
  "client_consents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: ["service", "reminders", "marketing"] }).notNull(),
    granted: boolean("granted").notNull(),
    textVersion: text("text_version").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("client_consents_purpose", sql`${t.purpose} IN ('service','reminders','marketing')`)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staff.id),
    clientId: uuid("client_id").references(() => clients.id),
    serviceId: uuid("service_id").notNull().references(() => services.id),
    during: tstzrange("during").notNull(),
    status: text("status", { enum: ["booked", "done", "cancelled", "noShow"] }).notNull().default("booked"),
    createdAt: created(),
  },
  (t) => [index("appointments_shop").on(t.shopId), check("appointments_status", sql`${t.status} IN ('booked','done','cancelled','noShow')`), check("appointments_bounded", sql`NOT isempty(${t.during}) AND NOT lower_inf(${t.during}) AND NOT upper_inf(${t.during})`)],
);

/** An invoice (or a credit note, `creditOf` set): its totals are the sum of its lines plus the taxes, at issue. */
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    number: text("number").notNull(),
    clientId: uuid("client_id").references(() => clients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    creditOf: uuid("credit_of"),
    language: text("language", { enum: ["fr", "en"] }).notNull().default("fr"),
    issuedOn: date("issued_on").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    gstCents: integer("gst_cents").notNull(),
    qstCents: integer("qst_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("invoices_number").on(t.shopId, t.number), check("invoices_total", sql`${t.totalCents} = ${t.subtotalCents} + ${t.gstCents} + ${t.qstCents}`), check("invoices_language", sql`${t.language} IN ('fr','en')`)],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCategory: text("tax_category", { enum: ["standard", "zeroRated", "exempt"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [uniqueIndex("invoice_lines_position").on(t.invoiceId, t.position), check("invoice_lines_amount", sql`${t.amountCents} = ${t.quantity} * ${t.unitPriceCents} - ${t.discountCents}`)],
);

/** A payment received against an invoice (cash, card, transfer) — recorded, not processed: no payment provider is wired. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    method: text("method", { enum: ["cash", "card", "transfer", "other"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("payments_method", sql`${t.method} IN ('cash','card','transfer','other')`)],
);

/** A business expense and the GST/QST paid on it (the source of the input tax credits and refunds). */
export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    supplier: text("supplier").notNull(),
    paidOn: date("paid_on").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    gstCents: integer("gst_cents").notNull(),
    qstCents: integer("qst_cents").notNull(),
    businessSharePct: smallint("business_share_pct").notNull().default(100),
    receiptRef: text("receipt_ref"),
    createdAt: created(),
  },
  (t) => [check("expenses_share", sql`${t.businessSharePct} BETWEEN 0 AND 100`), check("expenses_amounts", sql`${t.subtotalCents} >= 0 AND ${t.gstCents} >= 0 AND ${t.qstCents} >= 0`)],
);

/** The GST/QST journal: append-only; a correction is a new entry. */
export const taxLedger = pgTable(
  "tax_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    period: date("period").notNull(),
    tax: text("tax", { enum: ["gst", "qst"] }).notNull(),
    direction: text("direction", { enum: ["collected", "credit"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    sourceKind: text("source_kind", { enum: ["invoice", "expense"] }).notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceLabel: text("source_label").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tax_ledger_period").on(t.shopId, t.period),
    index("tax_ledger_source").on(t.sourceKind, t.sourceId),
    check("tax_ledger_period_month", sql`extract(day from ${t.period}) = 1`),
    check("tax_ledger_tax", sql`${t.tax} IN ('gst','qst')`),
    check("tax_ledger_direction", sql`${t.direction} IN ('collected','credit')`),
    check("tax_ledger_source_direction", sql`(${t.sourceKind} = 'invoice' AND ${t.direction} = 'collected') OR (${t.sourceKind} = 'expense' AND ${t.direction} = 'credit')`),
  ],
);
