import { sql } from "drizzle-orm";
import { bigserial, boolean, check, customType, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, smallint, text, time, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    /** The account baseline (@krizaka/auth, migration 0017). */
    name: text("name"),
    avatarSeed: text("avatar_seed"),
    theme: text("theme"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: created(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** The founder offer: the payments processor's ids and the subscription's state, written by its notifications only (0010_billing). */
    paymentCustomerId: text("payment_customer_id"),
    paymentSubscriptionId: text("payment_subscription_id"),
    subscriptionStatus: text("subscription_status"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    /** The catalogue's version this subscription was sold at (0035_prices): a founder keeps its price. */
    subscriptionPriceVersion: text("subscription_price_version"),
  },
  (t) => [check("accounts_email_lower", sql`${t.email} = lower(${t.email})`), check("accounts_role", sql`${t.role} IN ('USER','ADMIN')`), check("accounts_status", sql`${t.status} IN ('ACTIVE','SUSPENDED')`), check("accounts_locale", sql`${t.locale} IN ('en','fr')`)],
);

/** Each payments notification, applied once (its id is the key). */
export const paymentEvents = pgTable("payment_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    kind: text("kind", { enum: ["salon", "boutique", "services", "other"] }).notNull(),
    /** The kind of business: it sets the words of the screens (« appointment » or « walk ») and whether a booking is made for a dog (krizaka/akinaza#117). */
    businessType: text("business_type", { enum: ["professional", "pets"] }).notNull().default("professional"),
    /** The terms new invoices are issued under, in days (0 = due on receipt): a buyer needs them from $500 (krizaka/akinaza#113). */
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
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
    /** The Monday brief by e-mail to the owner; off in one click from the mail (0023). */
    briefEmail: boolean("brief_email").notNull().default(true),
    invoiceMailMessage: text("invoice_mail_message").notNull().default(""),
    invoiceMailFromName: text("invoice_mail_from_name"),
    invoiceMailCopy: boolean("invoice_mail_copy").notNull().default(false),
    invoiceLinkDays: integer("invoice_link_days").notNull().default(30),
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
    publicWebsite: text("public_website"),
    /** What a seat of a group service is called (« chiens », « dogs »): « Up to 5 dogs ». Empty = « places ». */
    seatUnitFr: text("seat_unit_fr"),
    seatUnitEn: text("seat_unit_en"),
    /** The shop the app opens on: exactly one per owner (the database keeps it, migration 0013). */
    isDefault: boolean("is_default").notNull().default(false),
    /** « organize »: a shop is an item (name, description, avatar, tags, collection come from @krizaka/organize; migration 0014). */
    description: text("description"),
    avatar: jsonb("avatar"),
    collectionId: uuid("collection_id"),
    /** When the shop received its default tag set (migration 0034, akinaza#337): once, so a deleted tag is not brought back. */
    organizedAt: timestamp("organized_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    check("shops_public_text", sql`length(coalesce(${t.area}, '')) <= 80 AND length(coalesce(${t.bioFr}, '')) <= 600 AND length(coalesce(${t.bioEn}, '')) <= 600 AND length(coalesce(${t.publicPhone}, '')) <= 40 AND length(coalesce(${t.publicEmail}, '')) <= 120 AND length(coalesce(${t.seatUnitFr}, '')) <= 30 AND length(coalesce(${t.seatUnitEn}, '')) <= 30`),
    uniqueIndex("shops_slug").on(t.slug).where(sql`${t.slug} IS NOT NULL`),
    check("shops_slug_format", sql`${t.slug} IS NULL OR (${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${t.slug}) BETWEEN 3 AND 40)`),
    check("shops_published_has_slug", sql`NOT ${t.published} OR ${t.slug} IS NOT NULL`),
    check("shops_kind", sql`${t.kind} IN ('salon','boutique','services','other')`),
    check("shops_payment_terms", sql`${t.paymentTermsDays} BETWEEN 0 AND 365`),
    check("shops_invoice_link_days", sql`${t.invoiceLinkDays} BETWEEN 1 AND 365`),
    check("shops_invoice_mail_message", sql`length(${t.invoiceMailMessage}) <= 500`),
    check("shops_invoice_mail_from_name", sql`${t.invoiceMailFromName} IS NULL OR length(${t.invoiceMailFromName}) BETWEEN 1 AND 120`),
    check("shops_business_type", sql`${t.businessType} IN ('professional','pets')`),
    check("shops_tax_numbers", sql`NOT ${t.registrant} OR (coalesce(${t.gstNumber}, '') ~ '^[0-9]{9}RT[0-9]{4}$' AND coalesce(${t.qstNumber}, '') ~ '^[0-9]{10}TQ[0-9]{4}$')`),
  ],
);

/** An area a shop serves (Saint-Henri, Griffintown…). A visit belongs to one. */
/** A shop's former page addresses: each leads to the shop (308) while it exists; never taken by another shop (0021, trigger). */
export const shopFormerSlugs = pgTable("shop_former_slugs", {
  slug: text("slug").primaryKey(),
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  retiredAt: timestamp("retired_at", { withTimezone: true }).notNull().defaultNow(),
});

/** What the owner did with a recommendation of the Monday brief: once per recommendation, its result kept (0022). */
export const briefActions = pgTable("brief_actions", {
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  recommendationId: text("recommendation_id").notNull(),
  kind: text("kind", { enum: ["invite", "price", "taxes"] }).notNull(),
  result: jsonb("result").$type<Record<string, number>>().notNull().default({}),
  doneAt: timestamp("done_at", { withTimezone: true }).notNull().defaultNow(),
});

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

/** The owner's ordered public sections and logo; absence means the original default page. */
export const shopPage = pgTable(
  "shop_page",
  {
    shopId: uuid("shop_id").primaryKey().references(() => shops.id, { onDelete: "cascade" }),
    sections: jsonb("sections").$type<{ id: string; visible: boolean }[]>().notNull().default(sql`'[{"id":"services","visible":true},{"id":"team","visible":true},{"id":"hours","visible":true},{"id":"zones","visible":true},{"id":"gallery","visible":true},{"id":"wall","visible":true},{"id":"reels","visible":true},{"id":"announcements","visible":true},{"id":"reviews","visible":true},{"id":"follow","visible":true}]'::jsonb`),
    logoUrl: text("logo_url"),
    /** The trade the owner chose (picks the default images); null = from the business type. */
    shopType: text("shop_type", { enum: ["salon", "coaching", "workshop", "cleaning", "pets", "consulting"] }),
    /** Whether the page shows the proposed images where the owner has none. */
    useDefaults: boolean("use_defaults").notNull().default(true),
    /** The template the owner applied (#261): id and version; null = today's page. */
    templateId: text("template_id"),
    templateVersion: integer("template_version"),
    /** The owner reordered or hid sections by hand: a template asks before replacing it. */
    sectionsCustom: boolean("sections_custom").notNull().default(false),
    /** The owner's text-style overrides per role (title, body, price). */
    style: jsonb("style").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("shop_page_template_pair", sql`(${t.templateId} IS NULL) = (${t.templateVersion} IS NULL) AND (${t.templateVersion} IS NULL OR ${t.templateVersion} >= 1)`), check("shop_page_template_id", sql`${t.templateId} IS NULL OR ${t.templateId} ~ '^[a-z]+-[a-z]+$'`), check("shop_page_shop_type", sql`${t.shopType} IS NULL OR ${t.shopType} IN ('salon','coaching','workshop','cleaning','pets','consulting')`), check("shop_page_logo_https", sql`${t.logoUrl} IS NULL OR (${t.logoUrl} LIKE 'https://%' AND length(${t.logoUrl}) <= 500)`)],
);

/** The owner's own figure thresholds (#260): only the keys they changed; no row = the administrator's defaults. Bounds are checked by the application and the shape by the database. */
export const shopFigureRules = pgTable(
  "shop_figure_rules",
  {
    shopId: uuid("shop_id").primaryKey().references(() => shops.id, { onDelete: "cascade" }),
    overrides: jsonb("overrides").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("shop_figure_rules_object", sql`jsonb_typeof(${t.overrides}) = 'object'`)],
);

/**
 * The private calendar feeds of a shop and of its staff members (ADR-004, #282): one active token per feed. Only the keyed hash of the token is kept,
 * so a leaked table opens nothing; rotating revokes the old row and adds a new one, revoking only revokes. `staff_id` null = the whole shop's feed.
 */
export const feedTokens = pgTable(
  "feed_tokens",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: created(),
    /** When this token replaced an earlier one (null = the feed's first token). */
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("feed_tokens_hash").on(t.tokenHash),
    index("feed_tokens_shop").on(t.shopId),
    uniqueIndex("feed_tokens_active_shop").on(t.shopId).where(sql`${t.staffId} IS NULL AND ${t.revokedAt} IS NULL`),
    uniqueIndex("feed_tokens_active_staff").on(t.shopId, t.staffId).where(sql`${t.staffId} IS NOT NULL AND ${t.revokedAt} IS NULL`),
    check("feed_tokens_hash_shape", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

/** The wall of the public page (B45, #310): its texture; no row = plaster and no item. */
export const shopWall = pgTable(
  "shop_wall",
  {
    shopId: uuid("shop_id").primaryKey().references(() => shops.id, { onDelete: "cascade" }),
    texture: text("texture", { enum: ["brick", "zellige", "ridge", "plaster"] }).notNull().default("plaster"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("shop_wall_texture", sql`${t.texture} IN ('brick','zellige','ridge','plaster')`)],
);

/** One thing pinned to the wall: a photo, a card, the sign. Percent positions, a small tilt, a stacking order; the bounds are the database's too. */
export const shopWallItems = pgTable(
  "shop_wall_items",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["polaroid", "note", "sign"] }).notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    rotation: doublePrecision("rotation").notNull().default(0),
    z: integer("z").notNull().default(0),
    attachment: text("attachment", { enum: ["tape", "pin"] }).notNull().default("tape"),
    variant: text("variant", { enum: ["enamel", "neon", "painted"] }),
    imageUrl: text("image_url"),
    altFr: text("alt_fr").notNull().default(""),
    altEn: text("alt_en").notNull().default(""),
    captionFr: text("caption_fr").notNull().default(""),
    captionEn: text("caption_en").notNull().default(""),
    textFr: text("text_fr").notNull().default(""),
    textEn: text("text_en").notNull().default(""),
    signature: text("signature").notNull().default(""),
  },
  (t) => [
    index("shop_wall_items_shop").on(t.shopId, t.z),
    check("shop_wall_items_kind", sql`${t.kind} IN ('polaroid','note','sign')`),
    check("shop_wall_items_place", sql`${t.x} BETWEEN 0 AND 100 AND ${t.y} BETWEEN 0 AND 100 AND ${t.rotation} BETWEEN -8 AND 8 AND ${t.z} BETWEEN 0 AND 1000`),
    check("shop_wall_items_texts", sql`length(${t.captionFr}) <= 40 AND length(${t.captionEn}) <= 40 AND length(${t.textFr}) <= 140 AND length(${t.textEn}) <= 140 AND length(${t.signature}) <= 40 AND length(${t.altFr}) <= 200 AND length(${t.altEn}) <= 200`),
    check("shop_wall_items_image", sql`${t.imageUrl} IS NULL OR (${t.imageUrl} LIKE 'https://%' AND length(${t.imageUrl}) <= 500)`),
  ],
);

/** The shop's reels (B45, #312): an uploaded vertical video (kept as CDN addresses) or a link to a TikTok, a YouTube Short or an Instagram reel. The latest is shown. */
export const shopReels = pgTable(
  "shop_reels",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["upload", "external"] }).notNull(),
    mp4Url: text("mp4_url"),
    webmUrl: text("webm_url"),
    posterUrl: text("poster_url"),
    seconds: doublePrecision("seconds"),
    platform: text("platform", { enum: ["tiktok", "youtube-shorts", "instagram"] }),
    externalUrl: text("external_url"),
    embedUrl: text("embed_url"),
    titleFr: text("title_fr").notNull().default(""),
    titleEn: text("title_en").notNull().default(""),
    createdAt: created(),
  },
  (t) => [
    index("shop_reels_shop").on(t.shopId, t.createdAt),
    check("shop_reels_kind", sql`(${t.kind} = 'upload' AND (${t.mp4Url} IS NOT NULL OR ${t.webmUrl} IS NOT NULL) AND ${t.platform} IS NULL) OR (${t.kind} = 'external' AND ${t.platform} IS NOT NULL AND ${t.externalUrl} IS NOT NULL AND ${t.embedUrl} IS NOT NULL)`),
    check("shop_reels_urls", sql`coalesce(${t.mp4Url}, 'https://') ~ '^https://' AND coalesce(${t.webmUrl}, 'https://') ~ '^https://' AND coalesce(${t.posterUrl}, 'https://') ~ '^https://' AND coalesce(${t.externalUrl}, 'https://') ~ '^https://' AND coalesce(${t.embedUrl}, 'https://') ~ '^https://'`),
    check("shop_reels_titles", sql`length(${t.titleFr}) <= 60 AND length(${t.titleEn}) <= 60`),
  ],
);

/** The shop's profile on a platform: a plain outbound link, one per platform. */
export const shopSocialLinks = pgTable(
  "shop_social_links",
  {
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: ["tiktok", "youtube", "instagram", "facebook"] }).notNull(),
    url: text("url").notNull(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.platform] }), check("shop_social_links_url", sql`${t.url} LIKE 'https://%' AND length(${t.url}) <= 300`), check("shop_social_links_platform", sql`${t.platform} IN ('tiktok','youtube','instagram','facebook')`)],
);

/** A client's word about the shop (B45, #313): a first name and an initial, never more. Only `published` and `verified` reviews count. Moves to @krizaka/reviews when it is published (krizaka-ts#37). */
export const shopReviews = pgTable(
  "shop_reviews",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    /** The client who wrote it; blanked with their erasure (Loi 25). */
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastInitial: text("last_initial").notNull().default(""),
    rating: smallint("rating").notNull(),
    body: text("body").notNull().default(""),
    serviceName: text("service_name").notNull().default(""),
    /** The person really had an appointment (the product says so; the score never guesses). */
    verified: boolean("verified").notNull().default(false),
    state: text("state", { enum: ["published", "hidden_by_owner", "removed_by_admin", "pending"] }).notNull().default("published"),
    reply: text("reply").notNull().default(""),
    createdAt: created(),
  },
  (t) => [
    index("shop_reviews_shop").on(t.shopId, t.createdAt),
    uniqueIndex("shop_reviews_one_per_client").on(t.shopId, t.clientId).where(sql`${t.clientId} IS NOT NULL`),
    check("shop_reviews_rating", sql`${t.rating} BETWEEN 1 AND 5`),
    check("shop_reviews_state", sql`${t.state} IN ('published','hidden_by_owner','removed_by_admin','pending')`),
    check("shop_reviews_texts", sql`length(${t.body}) <= 1000 AND length(${t.reply}) <= 1000 AND length(${t.firstName}) <= 40 AND length(${t.lastInitial}) <= 2 AND length(${t.serviceName}) <= 120`),
  ],
);

/** A flyer of the bulletin board (B45, #314): up to 500 characters in either language, an optional photo, an optional last day. */
export const shopAnnouncements = pgTable(
  "shop_announcements",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    textFr: text("text_fr").notNull().default(""),
    textEn: text("text_en").notNull().default(""),
    photoUrl: text("photo_url"),
    photoAlt: text("photo_alt").notNull().default(""),
    /** The last day the flyer is up (the shop's local day); null = until the owner takes it down. */
    endsOn: date("ends_on", { mode: "string" }),
    createdAt: created(),
  },
  (t) => [
    index("shop_announcements_shop").on(t.shopId, t.createdAt),
    check("shop_announcements_text", sql`length(${t.textFr}) <= 500 AND length(${t.textEn}) <= 500 AND length(${t.textFr}) + length(${t.textEn}) > 0 AND length(${t.photoAlt}) <= 200`),
    check("shop_announcements_photo", sql`${t.photoUrl} IS NULL OR (${t.photoUrl} LIKE 'https://%' AND length(${t.photoUrl}) <= 500)`),
  ],
);

/** The languages the owner turned on for the shop page (#258): the language the owner writes in and the ones offered. No row = French source, French and English. */
export const shopLanguages = pgTable(
  "shop_languages",
  {
    shopId: uuid("shop_id").primaryKey().references(() => shops.id, { onDelete: "cascade" }),
    sourceLocale: text("source_locale", { enum: ["fr", "en"] }).notNull().default("fr"),
    enabled: text("enabled").array().notNull().default(sql`'{fr,en}'::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("shop_languages_source", sql`${t.sourceLocale} IN ('fr','en')`), check("shop_languages_enabled", sql`${t.enabled} <@ ARRAY['fr','en','es'] AND ${t.sourceLocale} = ANY (${t.enabled})`)],
);

/** One translated text of the page: its place (kind, ref, field), language, status (`auto` or `edited`), the Orazaka run and the hash of the source text it was made from (a changed source makes it stale). */
export const shopTranslations = pgTable(
  "shop_translations",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["shop", "service"] }).notNull(),
    refId: uuid("ref_id").notNull(),
    field: text("field").notNull(),
    locale: text("locale", { enum: ["fr", "en", "es"] }).notNull(),
    text: text("text").notNull(),
    status: text("status", { enum: ["auto", "edited"] }).notNull(),
    runId: text("run_id"),
    sourceHash: text("source_hash").notNull(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("shop_translations_unique").on(t.shopId, t.kind, t.refId, t.field, t.locale), check("shop_translations_text", sql`length(${t.text}) BETWEEN 1 AND 2000`)],
);

/** Translation runs per shop and day (the administrator's daily limit). */
export const shopTranslationRuns = pgTable("shop_translation_runs", {
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  runs: integer("runs").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.shopId, t.day] })]);

export const staff = pgTable("staff", {
  id: id(),
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  /** The sign-in of this person, when they have one (a team member invited as staff; migration 0020). */
  accountId: uuid("account_id"),
  /** The owner is the first person created. */
  createdAt: created(),
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
  (t) => [index("services_shop").on(t.shopId), check("services_capacity", sql`${t.capacity} BETWEEN 1 AND 50`), check("services_duration", sql`${t.durationMinutes} BETWEEN 5 AND 600`), check("services_price", sql`${t.priceCents} >= 0`), check("services_tax_category", sql`${t.taxCategory} IN ('standard','zeroRated','exempt')`)],
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
    /** The invoice this one replaces after a correction (#207): set at insert, unique (0024). */
    replaces: uuid("replaces"),
    language: text("language", { enum: ["fr", "en"] }).notNull().default("fr"),
    issuedOn: date("issued_on").notNull(),
    /** The payment terms the invoice was issued under and the day they make it due; null on a credit note and on an invoice issued before the terms existed. */
    termsDays: integer("terms_days"),
    dueOn: date("due_on"),
    subtotalCents: integer("subtotal_cents").notNull(),
    gstCents: integer("gst_cents").notNull(),
    qstCents: integer("qst_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("invoices_number").on(t.shopId, t.number), check("invoices_total", sql`${t.totalCents} = ${t.subtotalCents} + ${t.gstCents} + ${t.qstCents}`), check("invoices_language", sql`${t.language} IN ('fr','en')`), check("invoices_terms", sql`(${t.termsDays} IS NULL AND ${t.dueOn} IS NULL) OR (${t.termsDays} IS NOT NULL AND ${t.dueOn} IS NOT NULL AND ${t.termsDays} BETWEEN 0 AND 365 AND ${t.dueOn} = ${t.issuedOn} + ${t.termsDays})`)],
);

/** A private, per-send invoice link. Only the token hash is retained; erasure revokes it. */
export const invoiceDeliveries = pgTable(
  "invoice_deliveries",
  {
    id: id(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    viewTokenHash: text("view_token_hash").notNull().unique(),
    toEmail: text("to_email").notNull(),
    createdAt: created(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("invoice_deliveries_invoice").on(t.invoiceId, t.createdAt)],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    /** The quantity in whole hundredths (7.5 hours → 750): the amount is round(quantity × unit price), half away from zero (krizaka/akinaza#111). */
    quantityHundredths: integer("quantity_hundredths").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCategory: text("tax_category", { enum: ["standard", "zeroRated", "exempt"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [uniqueIndex("invoice_lines_position").on(t.invoiceId, t.position), check("invoice_lines_quantity", sql`${t.quantityHundredths} <> 0`), check("invoice_lines_amount", sql`${t.amountCents} = round((${t.quantityHundredths}::bigint * ${t.unitPriceCents}::bigint)::numeric / 100) - ${t.discountCents}`)],
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
  (t) => [index("expenses_shop").on(t.shopId, t.paidOn), check("expenses_share", sql`${t.businessSharePct} BETWEEN 0 AND 100`), check("expenses_amounts", sql`${t.subtotalCents} >= 0 AND ${t.gstCents} >= 0 AND ${t.qstCents} >= 0`)],
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
  (t) => [index("dependants_client").on(t.clientId), index("dependants_shop").on(t.shopId), check("dependants_kind", sql`${t.kind} IN ('dog','cat','other')`), check("dependants_erased", sql`${t.erasedAt} IS NULL OR (${t.name} = '—' AND ${t.profile} = '{}'::jsonb)`)],
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
    ccEmail: text("cc_email"),
    fromName: text("from_name"),
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

/** Who has which role in which shop (migration 0020, `@krizaka/auth`): the owner of a shop is its `owner` member. */
export const memberships = pgTable(
  "memberships",
  {
    scopeId: uuid("scope_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "manager", "staff"] }).notNull(),
    invitedBy: uuid("invited_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("memberships_account").on(t.accountId)],
);

/** A client's request kept at a shop, to renew in one tap (akinaza#210): the files are on the media storage. */
export const clientRequests = pgTable(
  "client_requests",
  {
    id: id(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    zoneId: uuid("zone_id").references(() => shopZones.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    note: text("note"),
    createdAt: created(),
  },
  (t) => [index("client_requests_client").on(t.clientId)],
);

/**
 * A signed note on a client file (D5): who wrote it (the account and the name it showed then), when, and the words. The shop's
 * own; erasing the client (Loi 25) deletes them.
 */
export const clientNotes = pgTable(
  "client_notes",
  {
    id: id(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    authorAccountId: uuid("author_account_id").references(() => accounts.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: created(),
  },
  (t) => [index("client_notes_shop_client").on(t.shopId, t.clientId, t.createdAt), check("client_notes_body", sql`length(btrim(${t.body})) BETWEEN 1 AND 2000`)],
);

/** A file attached to a request: its CDN address on the media storage, its kind and size — never the bytes. */
export const clientRequestFiles = pgTable(
  "client_request_files",
  {
    id: id(),
    requestId: uuid("request_id").notNull().references(() => clientRequests.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: text("kind", { enum: ["image", "pdf"] }).notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: created(),
  },
  (t) => [index("client_request_files_request").on(t.requestId)],
);
