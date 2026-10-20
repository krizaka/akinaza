/**
 * Social and listings sync (ADR-002). Akinaza is the source of truth for the storefront; a platform is a mirror. This
 * module is the pure part: the connector interface, the field mapping (data), the canonical comparison, the plan (what is
 * proposed to the owner, what is pushed), the retry with backoff, and `scrub` (a token never reaches a log).
 */

/** Platforms that have a connector. Apple, Yelp and Bing have no usable API: they are guidance, not connectors. */
export const PLATFORMS = ["google", "facebook", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const GUIDANCE_PLATFORMS = ["apple", "bing", "yelp"] as const;
export type GuidancePlatform = (typeof GUIDANCE_PLATFORMS)[number];
export const isPlatform = (value: string): value is Platform => (PLATFORMS as readonly string[]).includes(value);

/** What syncs. Photos come with the real connectors (slices 2–3). */
export const SYNC_FIELDS = ["hours", "description", "phone", "email", "website"] as const;
export type SyncField = (typeof SYNC_FIELDS)[number];

export interface HourRun {
  startsAt: string;
  endsAt: string;
}
/** Weekly hours by weekday (0 = Sunday … 6 = Saturday), `HH:MM`, sorted, back-to-back runs merged. */
export type Hours = Record<number, HourRun[]>;

/** The storefront's syncable facts, or what a platform says of the same. Absent = unknown; empty string/hours = « none ». */
export interface Profile {
  hours?: Hours;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export type SyncDirection = "both" | "pull" | "push";
export interface FieldMapping {
  /** The platform's own name for the field (documentation, and what a real connector reads/writes). */
  remote: string;
  direction: SyncDirection;
  /** The longest value the platform takes. */
  maxLength?: number;
}

/** Field mapping as data: adding a platform or a field is an entry here and a test, not control flow. */
export const FIELD_MAPPINGS: Record<Platform, Partial<Record<SyncField, FieldMapping>>> = {
  google: {
    hours: { remote: "regularHours", direction: "both" },
    description: { remote: "profile.description", direction: "both", maxLength: 750 },
    phone: { remote: "phoneNumbers.primaryPhone", direction: "both" },
    website: { remote: "websiteUri", direction: "both" },
  },
  facebook: {
    hours: { remote: "hours", direction: "both" },
    description: { remote: "about", direction: "both", maxLength: 255 },
    phone: { remote: "phone", direction: "both" },
    email: { remote: "emails", direction: "pull" },
    website: { remote: "website", direction: "both" },
  },
  // The bio is not documented as writable through the API; read it, never write it.
  instagram: {
    description: { remote: "biography", direction: "pull" },
    website: { remote: "website", direction: "pull" },
  },
};

export const mappedFields = (platform: Platform): SyncField[] => SYNC_FIELDS.filter((f) => FIELD_MAPPINGS[platform][f]);

// ---- canonical form ---------------------------------------------------------------------------------------------

const clock = (v: string) => v.slice(0, 5);
const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));

/** Weekly windows of any shape → the canonical hours. */
export function canonicalHours(windows: readonly { weekday: number; startsAt: string; endsAt: string }[]): Hours {
  const out: Hours = {};
  for (const w of [...windows].sort((a, b) => a.weekday - b.weekday || clock(a.startsAt).localeCompare(clock(b.startsAt)))) {
    const runs = (out[w.weekday] ??= []);
    const last = runs[runs.length - 1];
    if (last && minutes(w.startsAt) <= minutes(last.endsAt)) {
      if (minutes(w.endsAt) > minutes(last.endsAt)) last.endsAt = clock(w.endsAt);
    } else runs.push({ startsAt: clock(w.startsAt), endsAt: clock(w.endsAt) });
  }
  return out;
}

/** The hours back as weekly windows (what the schedule stores). */
export const hoursToWindows = (hours: Hours) => Object.entries(hours).flatMap(([weekday, runs]) => runs.map((r) => ({ weekday: Number(weekday), ...r })));

/** North-American numbers: the ten digits (a leading country code 1 dropped). */
export const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
};
const stripTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
};
export const normalizeWebsite = (value: string): string => stripTrailingSlashes(value.trim().toLowerCase().replace(/^https?:\/\//, ""));
const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const present = (field: SyncField, value: unknown): boolean => (field === "hours" ? Object.keys((value as Hours | undefined) ?? {}).length > 0 : typeof value === "string" && value.trim() !== "");

function same(field: SyncField, a: Profile, b: Profile): boolean {
  if (field === "hours") return JSON.stringify(canonicalHours(hoursToWindows(a.hours ?? {}))) === JSON.stringify(canonicalHours(hoursToWindows(b.hours ?? {})));
  const x = a[field] ?? "";
  const y = b[field] ?? "";
  if (field === "phone") return normalizePhone(x) === normalizePhone(y);
  if (field === "website") return normalizeWebsite(x) === normalizeWebsite(y);
  if (field === "email") return x.trim().toLowerCase() === y.trim().toLowerCase();
  return normalizeText(x) === normalizeText(y);
}

// ---- the diff and the plan -------------------------------------------------------------------------------------

export type DiffState = "same" | "changed" | "remote_only" | "local_only";
export interface FieldDiff {
  field: SyncField;
  state: DiffState;
  direction: SyncDirection;
  local: Profile[SyncField];
  remote: Profile[SyncField];
  maxLength?: number;
}

/** Field by field, for the fields the platform maps AND returned. */
export function diffProfiles(platform: Platform, local: Profile, remote: Profile): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const field of SYNC_FIELDS) {
    const mapping = FIELD_MAPPINGS[platform][field];
    if (!mapping || remote[field] === undefined) continue;
    const l = present(field, local[field]);
    const r = present(field, remote[field]);
    const state: DiffState = same(field, local, remote) ? "same" : l && r ? "changed" : r ? "remote_only" : "local_only";
    out.push({ field, state, direction: mapping.direction, local: local[field], remote: remote[field], ...(mapping.maxLength ? { maxLength: mapping.maxLength } : {}) });
  }
  return out;
}

export interface SyncPlan {
  /** Differences the owner decides (their value may replace Akinaza's). */
  propose: FieldDiff[];
  /** Akinaza's values to send. */
  push: FieldDiff[];
  skipped: { field: SyncField; reason: "too_long" }[];
}

const PULLS: ReadonlySet<SyncDirection> = new Set<SyncDirection>(["both", "pull"]);
const PUSHES: ReadonlySet<SyncDirection> = new Set<SyncDirection>(["both", "push"]);

const tooLong = (d: FieldDiff) => d.maxLength !== undefined && typeof d.local === "string" && d.local.length > d.maxLength;

/**
 * What to do with a diff. `pending` = fields with an undecided proposal (never touched); `keep` = fields the owner chose to
 * keep Akinaza's value for (pushed). Only on the platform: proposed. Only in Akinaza: pushed. Differing: proposed, and
 * pushed once the owner kept Akinaza's value. A value longer than the platform takes is skipped, and said.
 */
export function plan(diffs: readonly FieldDiff[], pending: ReadonlySet<SyncField>, keep: ReadonlySet<SyncField> = new Set()): SyncPlan {
  const result: SyncPlan = { propose: [], push: [], skipped: [] };
  const send = (d: FieldDiff) => (tooLong(d) ? result.skipped.push({ field: d.field, reason: "too_long" }) : result.push.push(d));
  for (const d of diffs) {
    if (pending.has(d.field)) continue;
    const canPull = PULLS.has(d.direction);
    const canPush = PUSHES.has(d.direction);
    switch (d.state) {
      case "same":
        break;
      case "remote_only":
        if (canPull) result.propose.push(d);
        break;
      case "local_only":
        if (canPush) send(d);
        break;
      case "changed":
        if ((keep.has(d.field) || !canPull) && canPush) send(d);
        else if (canPull) result.propose.push(d);
        break;
    }
  }
  return result;
}

// ---- retry ------------------------------------------------------------------------------------------------------

export type ConnectorErrorKind = "rate_limited" | "transient" | "auth" | "invalid";

/** What a connector throws. The message never carries a secret it was told about. */
export class ConnectorError extends Error {
  readonly retryAfterMs: number | undefined;
  constructor(readonly kind: ConnectorErrorKind, message: string, options: { retryAfterMs?: number; secrets?: readonly string[] } = {}) {
    super(redactStrings(message, options.secrets ?? []));
    this.name = "ConnectorError";
    this.retryAfterMs = options.retryAfterMs;
  }
}

const RETRYABLE: ReadonlySet<ConnectorErrorKind> = new Set<ConnectorErrorKind>(["rate_limited", "transient"]);

// @fixed: the backoff's base and ceiling — a politeness bound towards third-party APIs, not a business parameter.
const BACKOFF_BASE_MS = 1_000;
// @fixed: see above.
const BACKOFF_CAP_MS = 60_000;

/** Exponential backoff with full jitter: attempt 1 waits up to 1 s, then 2, 4… capped at a minute. `random` in [0, 1]. */
export const retryDelayMs = (attempt: number, random: () => number = Math.random): number => Math.floor(random() * Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1)));

export interface RetryOptions {
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/** Retries a rate limit (after the delay the platform asked for) and a transient failure; authentication and validation errors stop at once. */
export async function withRetry<T>(run: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  // @fixed: three tries bound the time an owner waits on a click.
  const max = options.maxAttempts ?? 3;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const retryable = error instanceof ConnectorError && RETRYABLE.has(error.kind);
      if (!retryable || attempt >= max) throw error;
      await sleep(error.retryAfterMs ?? retryDelayMs(attempt, options.random));
    }
  }
}

// ---- secrets never reach a log ---------------------------------------------------------------------------------

const SECRET_KEY = /token|secret|password|authorization|cookie|code|credential|apikey|api_key/i;
const MASK = "[redacted]";

function redactStrings(text: string, secrets: readonly string[]): string {
  return secrets.filter((s) => s.length >= 3).reduce((acc, s) => acc.split(s).join(MASK), text);
}

/** A copy of `value` safe to write to a log: secret-looking keys dropped, known secrets masked inside strings, deeply. */
export function scrub(value: unknown, secrets: readonly string[] = []): unknown {
  if (typeof value === "string") return redactStrings(value, secrets);
  if (Array.isArray(value)) return value.map((v) => scrub(v, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !SECRET_KEY.test(k)).map(([k, v]) => [k, scrub(v, secrets)]));
  }
  return value;
}

// ---- the connector interface -----------------------------------------------------------------------------------

/** What a connection holds; sealed at rest, never returned by an API. */
export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  /** ISO instant. */
  expiresAt?: string;
  /** The account/page/location the owner picked, and a label to show. */
  externalId?: string;
  externalLabel?: string;
  scopes?: string[];
}

export interface ConnectorStatus {
  ok: boolean;
  /** Why not: a stable code (`revoked`, `expired`…). */
  problem?: string;
}

/** The limits a connector keeps to, as data (documentation and the retry policy read them). */
export interface ConnectorLimits {
  editsPerMinute?: number;
}

/**
 * One interface for every platform. `authorizeUrl` + `exchange` are `connect` (OAuth); `pull` reads the platform's
 * profile; `push` sends Akinaza's values; `status` checks the connection; `revoke` is `disconnect`'s provider half.
 */
export interface SocialConnector {
  readonly platform: Platform;
  readonly limits: ConnectorLimits;
  authorizeUrl(input: { state: string; redirectUri: string }): string;
  exchange(input: { code: string; shopKey: string }): Promise<Tokens>;
  pull(tokens: Tokens): Promise<Profile>;
  push(tokens: Tokens, values: Profile): Promise<void>;
  status(tokens: Tokens): Promise<ConnectorStatus>;
  revoke(tokens: Tokens): Promise<void>;
}

// ---- the fake ---------------------------------------------------------------------------------------------------

const FAKE_REMOTE: Record<Platform, () => Profile> = {
  google: () => ({ hours: canonicalHours([1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "09:00", endsAt: "17:00" }))), description: "Dog walking in Saint-Henri.", phone: "(514) 555-0123", website: "https://pattes.example.test/" }),
  facebook: () => ({ hours: {}, description: "", phone: "", email: "", website: "" }),
  instagram: () => ({ description: "Walks and wags", website: "" }),
};

/** In-memory connector for tests and development: a remote profile per (platform, tokens), real revocation and error behaviour. */
export class FakeConnector implements SocialConnector {
  readonly limits: ConnectorLimits = { editsPerMinute: 10 };
  private static remotes = new Map<string, Profile>();
  private static revoked = new Set<string>();
  /** Failures to throw before succeeding, by call (tests drive the retry with it). */
  failures: ConnectorError[] = [];

  constructor(readonly platform: Platform) {}

  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL(redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code", "fake-code");
    return url.toString();
  }

  async exchange({ code, shopKey }: { code: string; shopKey: string }): Promise<Tokens> {
    if (code !== "fake-code") throw new ConnectorError("invalid", "unknown authorization code");
    const accessToken = `fake-access-${this.platform}-${shopKey}-${Math.random().toString(36).slice(2)}`;
    FakeConnector.remotes.set(accessToken, FAKE_REMOTE[this.platform]());
    return { accessToken, refreshToken: `fake-refresh-${accessToken.slice(12)}`, externalId: `fake-${this.platform}-${shopKey}`, externalLabel: `Fake ${this.platform} page`, scopes: ["profile.read", "profile.write"] };
  }

  private open(tokens: Tokens): Profile {
    const failure = this.failures.shift();
    if (failure) throw failure;
    const remote = FakeConnector.remotes.get(tokens.accessToken);
    if (FakeConnector.revoked.has(tokens.accessToken) || !remote) throw new ConnectorError("auth", "the connection was revoked", { secrets: [tokens.accessToken] });
    return remote;
  }

  async pull(tokens: Tokens): Promise<Profile> {
    return structuredClone(this.open(tokens));
  }

  async push(tokens: Tokens, values: Profile): Promise<void> {
    Object.assign(this.open(tokens), structuredClone(values));
  }

  async status(tokens: Tokens): Promise<ConnectorStatus> {
    return FakeConnector.revoked.has(tokens.accessToken) || !FakeConnector.remotes.has(tokens.accessToken) ? { ok: false, problem: "revoked" } : { ok: true };
  }

  async revoke(tokens: Tokens): Promise<void> {
    FakeConnector.revoked.add(tokens.accessToken);
  }
}

// ---- what a platform tells us is not trusted ---------------------------------------------------------------------

// @fixed: the storefront's own limits (shops_public_text / shops_public_website checks) — what the database accepts.
const LIMITS = { description: 600, phone: 40, email: 120, website: 200 } as const;

/**
 * A remote profile made safe to store: text trimmed and cut to what the storefront holds, a website kept only if it is an
 * http(s) address (never `javascript:`), an e-mail only if it looks like one. Hours are kept as they are (canonical form).
 */
export function sanitizeProfile(remote: Profile): Profile {
  const out: Profile = {};
  if (remote.hours !== undefined) out.hours = canonicalHours(hoursToWindows(remote.hours).filter((w) => /^\d{2}:\d{2}/.test(w.startsAt) && /^\d{2}:\d{2}/.test(w.endsAt) && minutes(w.endsAt) > minutes(w.startsAt) && w.weekday >= 0 && w.weekday <= 6));
  if (remote.description !== undefined) out.description = normalizeText(remote.description).slice(0, LIMITS.description);
  if (remote.phone !== undefined) out.phone = remote.phone.trim().slice(0, LIMITS.phone);
  if (remote.email !== undefined) {
    const email = remote.email.trim();
    out.email = email.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
  }
  if (remote.website !== undefined) out.website = /^https?:\/\/\S+$/i.test(remote.website.trim()) && remote.website.trim().length <= LIMITS.website ? remote.website.trim() : "";
  return out;
}
