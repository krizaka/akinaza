import { sql } from "drizzle-orm";
import { bigserial, boolean, check, customType, date, doublePrecision, index, integer, jsonb, pgTable, smallint, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** A PostgreSQL `bytea` — a report photo (a resized image, 1.5 MB at most). */
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

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
    /** The public page address (`/{locale}/s/{slug}`); the page is served only when `published`. */
    slug: text("slug"),
    published: boolean("published").notNull().default(false),
    taglineFr: text("tagline_fr"),
    taglineEn: text("tagline_en"),
    /** The locality shown on the public page (« Saint-Henri, Montréal »): never the street address. */
    area: text("area"),
    /** The owner's short bio, in each language, shown on the public page. */
    bioFr: text("bio_fr"),
    bioEn: text("bio_en"),
    /** How a visitor reaches the shop before booking; both optional, both public. */
    publicPhone: text("public_phone"),
    publicEmail: text("public_email"),
    /** What a seat of a group service is called (« chiens », « dogs »): « Up to 5 dogs ». Empty = « places ». */
    seatUnitFr: text("seat_unit_fr"),
    seatUnitEn: text("seat_unit_en"),
    createdAt: created(),
  },
  (t) => [
    check("shops_public_text", sql`length(coalesce(${t.area}, '')) <= 80 AND length(coalesce(${t.bioFr}, '')) <= 600 AND length(coalesce(${t.bioEn}, '')) <= 600 AND length(coalesce(${t.publicPhone}, '')) <= 40 AND length(coalesce(${t.publicEmail}, '')) <= 120 AND length(coalesce(${t.seatUnitFr}, '')) <= 30 AND length(coalesce(${t.seatUnitEn}, '')) <= 30`),
    uniqueIndex("shops_slug").on(t.slug).where(sql`${t.slug} IS NOT NULL`),
    check("shops_slug_format", sql`${t.slug} IS NULL OR (${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${t.slug}) BETWEEN 3 AND 40)`),
    check("shops_published_has_slug", sql`NOT ${t.published} OR ${t.slug} IS NOT NULL`),
    check("shops_kind", sql`${t.kind} IN ('salon','bakery','cafe','boutique','services','other')`),
    check("shops_tax_numbers", sql`NOT ${t.registrant} OR (coalesce(${t.gstNumber}, '') ~ '^[0-9]{9}RT[0-9]{4}$' AND coalesce(${t.qstNumber}, '') ~ '^[0-9]{10}TQ[0-9]{4}$')`),
  ],
);

/** An area a shop serves (Saint-Henri, Griffintown…). A visit belongs to one. */
export const shopZones = pgTable(
  "shop_zones",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    /** Where the area is centred (WGS 84), for the map of the public page; both or neither. */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
  },
  (t) => [
    uniqueIndex("shop_zones_name_per_shop").on(t.shopId, sql`lower(${t.name})`),
    check("shop_zones_name", sql`length(btrim(${t.name})) BETWEEN 1 AND 80`),
    check("shop_zones_position", sql`(${t.lat} IS NULL) = (${t.lng} IS NULL) AND (${t.lat} IS NULL OR (${t.lat} BETWEEN -90 AND 90 AND ${t.lng} BETWEEN -180 AND 180))`),
  ],
);

/** What a photo of the public page is for. */
export const MediaRole = { Cover: "cover", Gallery: "gallery" } as const;
export type MediaRole = (typeof MediaRole)[keyof typeof MediaRole];

/** A photo or a loop of the shop's public page: the cover (one) and the gallery. The files live on the media CDN; only their https addresses are kept. */
export const shopMedia = pgTable(
  "shop_media",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    role: text("role", { enum: [MediaRole.Cover, MediaRole.Gallery] }).notNull(),
    /** The still: a photo, or the poster of a loop. */
    url: text("url").notNull(),
    webmUrl: text("webm_url"),
    mp4Url: text("mp4_url"),
    altFr: text("alt_fr").notNull().default(""),
    altEn: text("alt_en").notNull().default(""),
    captionFr: text("caption_fr"),
    captionEn: text("caption_en"),
    /** The still is a landscape picture (4:3 tile); the default is a portrait. */
    wide: boolean("wide").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("shop_media_shop").on(t.shopId, t.role, t.position),
    uniqueIndex("shop_media_one_cover").on(t.shopId).where(sql`${t.role} = 'cover'`),
    check("shop_media_role", sql`${t.role} IN ('cover','gallery')`),
    check("shop_media_urls", sql`${t.url} ~ '^https://' AND coalesce(${t.webmUrl}, 'https://') ~ '^https://' AND coalesce(${t.mp4Url}, 'https://') ~ '^https://'`),
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
    /** The most dependants one visit takes: 1 = individual, N = group. */
    capacity: integer("capacity").notNull().default(1),
    active: boolean("active").notNull().default(true),
    /** What the service is, in a sentence or two, and what is included (short lines): the public page's card. */
    descriptionFr: text("description_fr"),
    descriptionEn: text("description_en"),
    includedFr: text("included_fr").array().notNull().default(sql`'{}'::text[]`),
    includedEn: text("included_en").array().notNull().default(sql`'{}'::text[]`),
    /** « From » on the card: the price varies with the dog, the size, the zone. */
    priceVaries: boolean("price_varies").notNull().default(false),
  },
  (t) => [check("services_capacity", sql`${t.capacity} BETWEEN 1 AND 50`), check("services_duration", sql`${t.durationMinutes} BETWEEN 5 AND 600`), check("services_price", sql`${t.priceCents} >= 0`), check("services_tax_category", sql`${t.taxCategory} IN ('standard','zeroRated','exempt')`)],
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
    /** The sign-in account of this person, once they signed in at the shop. */
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    /** Keys and door codes: AES-256-GCM ciphertext (`v1.<iv>.<tag>.<data>`), never plain text. */
    accessNotesEnc: text("access_notes_enc"),
    createdAt: created(),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
  },
  (t) => [
    index("clients_shop").on(t.shopId),
    uniqueIndex("clients_account_per_shop").on(t.shopId, t.accountId).where(sql`${t.accountId} IS NOT NULL`),
    check("clients_erased", sql`${t.erasedAt} IS NULL OR (${t.email} IS NULL AND ${t.phone} IS NULL AND ${t.notes} IS NULL AND ${t.accessNotesEnc} IS NULL AND ${t.accountId} IS NULL)`),
    check("clients_access_notes_sealed", sql`${t.accessNotesEnc} IS NULL OR ${t.accessNotesEnc} ~ '^v[0-9]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'`),
  ],
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
    zoneId: uuid("zone_id").references(() => shopZones.id),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [check("appointments_check_order", sql`${t.checkedOutAt} IS NULL OR (${t.checkedInAt} IS NOT NULL AND ${t.checkedOutAt} >= ${t.checkedInAt})`), index("appointments_shop").on(t.shopId), check("appointments_status", sql`${t.status} IN ('booked','done','cancelled','noShow')`), check("appointments_bounded", sql`NOT isempty(${t.during}) AND NOT lower_inf(${t.during}) AND NOT upper_inf(${t.during})`)],
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

/** A staff member's days off (a date, in the shop's zone). */
export const daysOff = pgTable(
  "days_off",
  {
    id: id(),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    onDate: date("on_date").notNull(),
    reason: text("reason"),
  },
  (t) => [uniqueIndex("days_off_staff_day").on(t.staffId, t.onDate)],
);

/** The shop's own rules — data, not constants (version 1 = the defaults); bounds are CHECKs and repeated by @akinaza/core. */
export const shopRules = pgTable(
  "shop_rules",
  {
    shopId: uuid("shop_id").primaryKey().references(() => shops.id, { onDelete: "cascade" }),
    cancellationHours: integer("cancellation_hours").notNull().default(24),
    bookingHorizonDays: integer("booking_horizon_days").notNull().default(60),
    slotStepMinutes: integer("slot_step_minutes").notNull().default(30),
    minNoticeMinutes: integer("min_notice_minutes").notNull().default(120),
    reportLinkDays: integer("report_link_days").notNull().default(30),
  },
  (t) => [
    check("shop_rules_cancellation", sql`${t.cancellationHours} BETWEEN 0 AND 168`),
    check("shop_rules_horizon", sql`${t.bookingHorizonDays} BETWEEN 1 AND 180`),
    check("shop_rules_step", sql`${t.slotStepMinutes} BETWEEN 5 AND 240`),
    check("shop_rules_notice", sql`${t.minNoticeMinutes} BETWEEN 0 AND 10080`),
    check("shop_rules_link", sql`${t.reportLinkDays} BETWEEN 1 AND 365`),
  ],
);

/** What a client brings to a visit (a dog, a cat…). The vertical's details are a validated JSON profile, erased with the client. */
export const dependants = pgTable(
  "dependants",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["dog", "cat", "other"] }).notNull(),
    name: text("name").notNull(),
    profile: jsonb("profile").notNull().default({}),
    createdAt: created(),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
  },
  (t) => [index("dependants_client").on(t.clientId), check("dependants_kind", sql`${t.kind} IN ('dog','cat','other')`), check("dependants_erased", sql`${t.erasedAt} IS NULL OR (${t.name} = '—' AND ${t.profile} = '{}'::jsonb)`)],
);

/** One dependant's seat on a visit. The database counts the seats against the service's capacity (trigger `bookings_rules`). */
export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    appointmentId: uuid("appointment_id").notNull().references(() => appointments.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    dependantId: uuid("dependant_id").notNull().references(() => dependants.id),
    status: text("status", { enum: ["booked", "cancelled"] }).notNull().default("booked"),
    createdAt: created(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("bookings_one_seat").on(t.appointmentId, t.dependantId).where(sql`${t.status} = 'booked'`),
    index("bookings_client").on(t.clientId),
    check("bookings_status", sql`${t.status} IN ('booked','cancelled')`),
    check("bookings_cancelled", sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`),
  ],
);

/** The report on a booking's visit: a note, a photo and a private link to read them. */
export const visitReports = pgTable(
  "visit_reports",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id),
    note: text("note").notNull(),
    photo: bytea("photo"),
    photoType: text("photo_type", { enum: ["jpeg", "png", "webp"] }),
    durationMinutes: integer("duration_minutes").notNull(),
    viewTokenHash: text("view_token_hash").notNull().unique(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    check("visit_reports_note", sql`length(${t.note}) BETWEEN 1 AND 1000`),
    check("visit_reports_photo_type", sql`(${t.photo} IS NULL) = (${t.photoType} IS NULL) AND (${t.photoType} IS NULL OR ${t.photoType} IN ('jpeg','png','webp'))`),
    check("visit_reports_photo_size", sql`${t.photo} IS NULL OR octet_length(${t.photo}) <= 1572864`),
    check("visit_reports_duration", sql`${t.durationMinutes} BETWEEN 1 AND 1440`),
  ],
);

/** What Akinaza said to whom, rendered; delivered when a mail provider is configured, otherwise it stays `pending`. */
export const mailOutbox = pgTable(
  "mail_outbox",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    locale: text("locale", { enum: ["fr", "en"] }).notNull().default("fr"),
    template: text("template").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    bodyText: text("body_text").notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    relatedKind: text("related_kind"),
    relatedId: uuid("related_id"),
    createdAt: created(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("mail_outbox_related").on(t.relatedKind, t.relatedId), check("mail_outbox_status", sql`${t.status} IN ('pending','sent','failed')`), check("mail_outbox_locale", sql`${t.locale} IN ('fr','en')`)],
);
