import { z } from "zod";

import type { MailSettings } from "./mail-settings";
import { ASSOCIATION, FOUNDER, PROCESSOR_PLANS, SCALE, STARTER } from "./pricing";

/**
 * Every environment variable of the app, declared once (named by bounded context — APP_, DATABASE_, AUTH_, ABUSE_ —
 * never by product or vendor: the vendor is a value; `MAIL_PROVIDER=mailgun`). A production server refuses to start
 * without its secrets (instrumentation.ts calls `assertProductionEnv`): no demo mode, no default key.
 */
const flag = z
  .string()
  .optional()
  .transform((v) => v?.trim().toLowerCase() === "true");
const list = z
  .string()
  .optional()
  .transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** The public origin of the site (canonical URLs, sitemap, llms.txt). */
  APP_PUBLIC_URL: z.string().url().default("https://www.akinaza.com"),
  /** The development address (`dev.akinaza.com`): every page goes to www (308); only the API, auth callbacks, webhooks, /.well-known and /healthz keep serving there, all noindex (lib/indexing.ts). Unset: no dev host. */
  APP_DEV_HOST: z.string().optional(),
  /** The registrable domain the shops live on (`akinaza.shop`): `<slug>.<domain>` serves a shop and nothing of the app, no session reaches it, the old addresses answer 308 (ADR-005 slice 5, lib/shop-domain.ts). Unset: shops stay on `<slug>.akinaza.com`. */
  APP_SHOP_DOMAIN: z.string().optional(),
  /** Hosts this deployment also answers to, comma separated, exact names (a preview with an address of its own). Every other host is a 421 (lib/allowed-hosts.ts). */
  APP_ALLOWED_HOSTS: list,
  /** The edge service that issues a certificate per merchant domain (ADR-005 §3, akinaza#539): its name is a value (`cloudflare`; `memory` for development and tests only). Unset: the option cannot be used. */
  APP_EDGE_PROVIDER: z.enum(["cloudflare", "memory"]).optional(),
  /** The edge service's API token and zone of the shop domain (keys by name, never printed). */
  APP_EDGE_API_TOKEN: z.string().optional(),
  APP_EDGE_ZONE_ID: z.string().optional(),
  /** The name merchants point their CNAME at (default `edge.akinaza.shop`). */
  APP_EDGE_CNAME_TARGET: z.string().optional(),
  /** Explorer's address search: a geocoding service that speaks the Nominatim protocol, and the attribution its terms ask for. Unset = the search is off (the map and the list still work). */
  APP_GEOCODER_URL: z.string().url().optional(),
  APP_GEOCODER_ATTRIBUTION_TEXT: z.string().optional(),
  APP_GEOCODER_ATTRIBUTION_URL: z.string().url().optional(),
  /** PostgreSQL (the cluster krizaka-dev-pg in dev: database akinaza_db, role akinaza_db). */
  DATABASE_URL: z.string().optional(),
  /** The cluster's CA (PEM), to verify its certificate; without it a TLS URL is refused in production. */
  DATABASE_CA_CERT: z.string().optional(),
  /** The key that seals the clients' access notes at rest (32 random bytes, base64). A DO SECRET; required in production. */
  APP_DATA_ENCRYPTION_KEY: z.string().optional(),
  /** Outgoing mail: the provider is a value (`mailgun`); `none` keeps every mail `pending` in the outbox (fails closed). */
  MAIL_PROVIDER: z.enum(["mailgun", "none"]).default("none"),
  MAIL_API_KEY: z.string().optional(),
  MAIL_DOMAIN: z.string().optional(),
  /** The sender, e.g. `Akinaza <no-reply@mg.akinaza.com>`; default `Akinaza <no-reply@MAIL_DOMAIN>`. */
  MAIL_FROM: z.string().optional(),
  /** The provider's API origin (EU region: `https://api.eu.mailgun.net`). */
  MAIL_API_URL: z.string().url().default("https://api.mailgun.net"),
  /** Keys the session tokens' hashes (≥ 32 characters). */
  AUTH_SESSION_SECRET: z.string().optional(),
  /** Sign-up is closed unless this is `true` (closed on every dev deployment: QA accounts only). */
  AUTH_SIGNUP_ENABLED: flag,
  /** The addresses that may open the administration (comma-separated). Empty in production = nobody. */
  AUTH_ALLOWED_IPS: list,
  /** A header the edge sets with the client's address (`do-connecting-ip` on App Platform). */
  ABUSE_CLIENT_IP_HEADER: z.string().optional(),
  ABUSE_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(10).default(1),
  /** The bot check of the public forms (the guest booking step): the service is a value (`turnstile`); unset, the check is off outside production and a refusal in production. The browser reads the public site half. */
  ABUSE_CAPTCHA_PROVIDER: z.enum(["turnstile"]).optional(),
  ABUSE_CAPTCHA_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_ABUSE_CAPTCHA_SITE_KEY: z.string().optional(),
  /** The stage of the deployment: `dev` shows the « Development version » notice on every page (`StageNotice`); `prod` hides it. Read at build too: the pages are static. */
  APP_ENVIRONMENT: z.enum(["dev", "prod"]).default("dev"),
  /** A fixed instant (ISO 8601) for the pages' clock, honoured only when `APP_ENVIRONMENT` is `dev` (visual and e2e runs: `app/request-now.ts`). Ignored in `prod`. */
  APP_FIXED_NOW: z.string().datetime().optional(),
  /** `off` on every dev / preview deployment: noindex everywhere, robots.txt closed, the development notice in the footer. */
  APP_SEARCH_INDEXING: z.enum(["on", "off"]).default("on"),
  /** Connections this process's pool may hold (the cluster's budget is shared: dev uses 2 behind a PgBouncer pool). */
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(50).default(5),
  /** A direct (non-pooled) PostgreSQL URL for LISTEN — @krizaka/realtime's bus. Defaults to DATABASE_URL. */
  DATABASE_DIRECT_URL: z.string().optional(),
  /** The realtime bus (booking slots): postgres (LISTEN/NOTIFY, default) or memory (one instance, tests). */
  REALTIME_BUS: z.enum(["postgres", "memory"]).default("postgres"),
  /** The media storage for the owners' storefront photos (the vendor is a value of the storage, not of the name); off when unset. */
  MEDIA_STORAGE_API_KEY: z.string().optional(),
  MEDIA_STORAGE_ZONE: z.string().optional(),
  MEDIA_STORAGE_ENDPOINT: z.string().optional(),
  /** The CDN host that serves the uploaded files (no scheme). */
  MEDIA_CDN_HOSTNAME: z.string().optional(),
  /** The payments vendor is a value (`stripe`); unset = payments off (fails closed, 503). Prices are data at the vendor, found by lookup key. */
  PAYMENTS_PROVIDER: z.enum(["stripe"]).optional(),
  PAYMENTS_STRIPE_SECRET_KEY: z.string().optional(),
  PAYMENTS_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  PAYMENTS_STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYMENTS_PRICE_KEY_FOUNDER: z.string().default(PROCESSOR_PLANS[FOUNDER].lookupKey),
  PAYMENTS_PRICE_KEY_STARTER: z.string().default(PROCESSOR_PLANS[STARTER].lookupKey),
  PAYMENTS_PRICE_KEY_SCALE: z.string().default(PROCESSOR_PLANS[SCALE].lookupKey),
  PAYMENTS_PRICE_KEY_ASSOCIATION: z.string().default(PROCESSOR_PLANS[ASSOCIATION].lookupKey),
  /** Akinaza's OAuth clients for the owner's calendars (ADR-004), created by the administrator at Google and at Microsoft; a provider without both halves is not offered. Each provider's flag in the administration is off by default. */
  AUTH_CALENDAR_GOOGLE_CLIENT_ID: z.string().optional(),
  AUTH_CALENDAR_GOOGLE_CLIENT_SECRET: z.string().optional(),
  AUTH_CALENDAR_OUTLOOK_CLIENT_ID: z.string().optional(),
  AUTH_CALENDAR_OUTLOOK_CLIENT_SECRET: z.string().optional(),
  /** The founder offer is shown on the public page only when this is `true` (after a test-card checkout is proven live). */
  APP_FOUNDER_OFFER_ENABLED: flag,
  /** The point of sale: off until the SRM scope and the payment provider are decided — and never for a restaurant or a bar. */
  APP_POS_ENABLED: flag,
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

/** What a production server cannot run without — named, never shown. */
export function productionProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production") {return [];}
  const problems: string[] = [];
  if (!env.DATABASE_URL) {problems.push("DATABASE_URL is not set");}
  if (!env.AUTH_SESSION_SECRET || env.AUTH_SESSION_SECRET.length < 32) {problems.push("AUTH_SESSION_SECRET must be at least 32 characters");}
  if (!validDataKey(env.APP_DATA_ENCRYPTION_KEY)) {problems.push("APP_DATA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded");}
  if (env.MAIL_PROVIDER === "mailgun" && !(env.MAIL_API_KEY && env.MAIL_DOMAIN)) {problems.push("MAIL_PROVIDER=mailgun needs MAIL_API_KEY and MAIL_DOMAIN");}
  if (env.DATABASE_URL && /sslmode=(require|verify)/.test(env.DATABASE_URL) && !env.DATABASE_CA_CERT) {problems.push("DATABASE_CA_CERT is required for a TLS database");}
  return problems;
}

export function assertProductionEnv(source: Record<string, string | undefined> = process.env): void {
  const problems = productionProblems(readEnv(source));
  if (problems.length) {throw new Error(`Akinaza refuses to start: ${problems.join("; ")}`);}
}

export const env = () => readEnv();
export const appEnvironment = () => readEnv().APP_ENVIRONMENT;
export const signupEnabled = () => env().AUTH_SIGNUP_ENABLED;
/** The administration's allow-list; `null` = no restriction (development only). */
export function consoleAllowedIps(source: Record<string, string | undefined> = process.env): string[] | null {
  const e = readEnv(source);
  if (e.AUTH_ALLOWED_IPS.length) {return e.AUTH_ALLOWED_IPS;}
  return e.NODE_ENV === "production" ? [] : null;
}

const DEV_SECRET = "development-only-session-secret-not-for-production";
export function sessionSecret(): string {
  const e = env();
  if (e.AUTH_SESSION_SECRET) {return e.AUTH_SESSION_SECRET;}
  if (e.NODE_ENV === "production") {throw new Error("AUTH_SESSION_SECRET is not set");}
  return DEV_SECRET;
}

/**
 * The key for the access notes. Production has the real one (the server refuses to start without it); development and
 * tests fall back to a fixed, public one — it protects nothing, and says so by its name.
 */
// @fixed: AES-256 takes exactly 32 bytes — a property of the cipher.
const DATA_KEY_BYTES = 32;
const validDataKey = (base64: string | undefined) => Buffer.from(base64 ?? "", "base64").length === DATA_KEY_BYTES;
const DEV_DATA_KEY = Buffer.alloc(32, "akinaza-development-only-data-key").toString("base64");
export function dataKey(source: Record<string, string | undefined> = process.env): Buffer {
  const e = readEnv(source);
  if (e.APP_DATA_ENCRYPTION_KEY) {
    if (!validDataKey(e.APP_DATA_ENCRYPTION_KEY)) {throw new Error("APP_DATA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded");}
    return Buffer.from(e.APP_DATA_ENCRYPTION_KEY, "base64");
  }
  if (e.NODE_ENV === "production") {throw new Error("APP_DATA_ENCRYPTION_KEY is not set");}
  return Buffer.from(DEV_DATA_KEY, "base64");
}

/** The OAuth clients configured for the calendar providers (a provider needs both its id and its secret). */
export function calendarOAuthApps(source: Record<string, string | undefined> = process.env): { google?: { clientId: string; clientSecret: string }; outlook?: { clientId: string; clientSecret: string } } {
  const e = readEnv(source);
  const pair = (clientId?: string, clientSecret?: string) => (clientId && clientSecret ? { clientId, clientSecret } : undefined);
  const google = pair(e.AUTH_CALENDAR_GOOGLE_CLIENT_ID, e.AUTH_CALENDAR_GOOGLE_CLIENT_SECRET);
  const outlook = pair(e.AUTH_CALENDAR_OUTLOOK_CLIENT_ID, e.AUTH_CALENDAR_OUTLOOK_CLIENT_SECRET);
  return { ...(google ? { google } : {}), ...(outlook ? { outlook } : {}) };
}

export function mailSettings(source: Record<string, string | undefined> = process.env): MailSettings {
  const e = readEnv(source);
  return { provider: e.MAIL_PROVIDER, apiKey: e.MAIL_API_KEY, domain: e.MAIL_DOMAIN, from: e.MAIL_FROM, apiUrl: e.MAIL_API_URL, appUrl: e.APP_PUBLIC_URL };
}
