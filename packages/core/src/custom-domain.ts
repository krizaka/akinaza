/**
 * A merchant's own domain (ADR-005 §3, akinaza#539). Ownership first (a TXT record), TLS second (the edge service issues a certificate for the
 * hostname), and only then the shop is served there. Everything here is pure: the DNS and the edge service are ports the caller passes in, so the
 * state machine is tested with stubs and the vendor stays a configuration value, never a name in this code.
 */

/** Where a custom domain is in its life. `pending-txt` and `pending-tls` are « not served yet »; only `active` is served. */
export const DOMAIN_STATE = {
  pendingTxt: "pending-txt",
  pendingTls: "pending-tls",
  active: "active",
  failed: "failed",
  suspended: "suspended",
  removed: "removed",
} as const;
export type DomainState = (typeof DOMAIN_STATE)[keyof typeof DOMAIN_STATE];

/** The states the periodic tick re-checks. */
export const CHECKED_STATES: readonly DomainState[] = [DOMAIN_STATE.pendingTxt, DOMAIN_STATE.pendingTls, DOMAIN_STATE.active];

/** A domain that claims its hostname once its TXT was proven: one shop at a time (the database holds the same rule as a partial unique index). */
export const CLAIMING_STATES: readonly DomainState[] = [DOMAIN_STATE.pendingTls, DOMAIN_STATE.active];

/** The label of the record the merchant adds: `_akinaza-verify.<hostname>`. */
export const TXT_PREFIX = "_akinaza-verify";
export const TXT_VALUE_PREFIX = "akinaza-site-verification=";

export const txtRecordName = (hostname: string): string => `${TXT_PREFIX}.${hostname}`;
export const txtRecordValue = (token: string): string => TXT_VALUE_PREFIX + token;

/** Registrable names that are ours: never accepted as a merchant's domain. */
const PLATFORM_DOMAINS = ["akinaza.com", "akinaza.shop", "krizaka.com", "krizaka.dev"];
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const MAX_HOSTNAME = 253;
const MIN_LABELS = 3;

export type HostnameIssue = "empty" | "invalid" | "ip" | "apex" | "platform";
export type HostnameCheck = { ok: true; hostname: string } | { ok: false; reason: HostnameIssue };

/**
 * What a merchant typed, read as a hostname: scheme, path, port and a trailing dot are dropped, the name is lower-cased. A subdomain is required
 * (`reservation.monsalon.ca`): the edge service does not proxy an apex on every plan. An IP, a platform name or a malformed label is refused.
 */
export function readHostname(input: string): HostnameCheck {
  const withoutScheme = input.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const raw = (withoutScheme.split(/[/?#]/)[0] ?? "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!raw) return { ok: false, reason: "empty" };
  if (IPV4.test(raw) || raw.includes(":") || raw.startsWith("[")) return { ok: false, reason: "ip" };
  const labels = raw.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (raw.length > MAX_HOSTNAME || labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !TLD.test(tld)) return { ok: false, reason: "invalid" };
  if (PLATFORM_DOMAINS.some((d) => raw === d || raw.endsWith(`.${d}`))) return { ok: false, reason: "platform" };
  if (labels.length < MIN_LABELS) return { ok: false, reason: "apex" };
  return { ok: true, hostname: raw };
}

/** What the edge service says of a hostname's certificate. */
export type TlsStatus = "pending" | "active" | "failed";

export interface HostnameReport {
  /** The service's id for the hostname, kept to ask again and to remove it. */
  id: string;
  tls: TlsStatus;
  /** Why the service gave up (shown to an administrator, never to the public). */
  error?: string;
}

/** The edge service that issues a certificate per hostname (a vendor behind it; the choice is configuration). */
export interface CustomHostnames {
  create(hostname: string): Promise<HostnameReport>;
  status(id: string): Promise<HostnameReport>;
  remove(id: string): Promise<void>;
}

/** The DNS the ownership proof is read from. */
export interface TxtResolver {
  txt(name: string): Promise<string[]>;
}

/** Whether the merchant's TXT record carries this token. A resolver error is « not found yet », never a verdict. */
export async function ownershipProven(dns: TxtResolver, hostname: string, token: string): Promise<boolean> {
  const records = await dns.txt(txtRecordName(hostname)).catch((): string[] => []);
  return records.some((r) => r.trim() === txtRecordValue(token));
}

export interface DomainSnapshot {
  state: DomainState;
  /** The service's id once the hostname was created there. */
  providerId: string | null;
  /** Checks that found nothing since the last progress. */
  attempts: number;
  createdAt: Date;
}

export interface DomainLimits {
  /** How many checks without the TXT before the domain is `failed` (a merchant can retry). */
  maxAttempts: number;
  /** How many checks in a row may miss the TXT of an `active` domain before it is suspended (a flaky resolver is not a lapse). */
  lapseAttempts: number;
  /** How long a domain may wait, from its creation, for its TXT or its certificate. */
  waitMs: number;
}

/** What one check changes. `release` asks the caller to remove the hostname at the edge. */
export interface DomainStep {
  state: DomainState;
  attempts: number;
  providerId: string | null;
  error: string | null;
  release: boolean;
}

export const DOMAIN_ERROR = {
  txtMissing: "txt-missing",
  tlsFailed: "tls-failed",
  tlsTimeout: "tls-timeout",
  edgeUnavailable: "edge-unavailable",
  taken: "taken",
  optionOff: "option-off",
} as const;

/**
 * One check of a domain, the whole state machine (pure; the ports are the caller's). `suspended`, `removed` and `failed` are never advanced here
 * (an administrator or the merchant moves them).
 * - `pending-txt`: the TXT proves ownership → the hostname is created at the edge → `pending-tls`; no TXT is a retry, then `failed` past the limits.
 * - `pending-tls`: the edge says the certificate is active → `active`; failed → `failed`; too slow → `failed`.
 * - `active`: the ownership is re-checked on every tick; if the TXT is gone for good (a former owner, a changed DNS), the domain is `suspended`
 *   and released at the edge, so a lapsed domain is never served on a stale proof.
 */
export async function checkDomain(
  domain: DomainSnapshot & { hostname: string; token: string },
  ports: { dns: TxtResolver; hostnames: CustomHostnames; now: Date; limits: DomainLimits },
): Promise<DomainStep> {
  const keep: DomainStep = { state: domain.state, attempts: domain.attempts, providerId: domain.providerId, error: null, release: false };
  const { dns, hostnames, now, limits } = ports;
  const expired = // Instants compared as numbers: the date facade (@krizaka/time) does not exist yet, and a new date-fns import is refused (krizaka-first-dates).
  domain.createdAt.valueOf() + limits.waitMs < now.valueOf();
  if (domain.state === DOMAIN_STATE.pendingTxt) {
    if (await ownershipProven(dns, domain.hostname, domain.token)) {
      const report = await hostnames.create(domain.hostname).catch((): null => null);
      if (!report) return { ...keep, attempts: domain.attempts + 1, error: DOMAIN_ERROR.edgeUnavailable };
      return { ...keep, state: DOMAIN_STATE.pendingTls, attempts: 0, providerId: report.id };
    }
    const attempts = domain.attempts + 1;
    return attempts >= limits.maxAttempts || expired ? { ...keep, state: DOMAIN_STATE.failed, attempts, error: DOMAIN_ERROR.txtMissing } : { ...keep, attempts, error: DOMAIN_ERROR.txtMissing };
  }
  if (domain.state === DOMAIN_STATE.pendingTls && domain.providerId) {
    const report = await hostnames.status(domain.providerId).catch((): null => null);
    if (!report) return { ...keep, error: DOMAIN_ERROR.edgeUnavailable };
    if (report.tls === "active") return { ...keep, state: DOMAIN_STATE.active, attempts: 0 };
    if (report.tls === "failed") return { ...keep, state: DOMAIN_STATE.failed, error: DOMAIN_ERROR.tlsFailed, release: true };
    return expired ? { ...keep, state: DOMAIN_STATE.failed, error: DOMAIN_ERROR.tlsTimeout, release: true } : keep;
  }
  if (domain.state === DOMAIN_STATE.active) {
    if (await ownershipProven(dns, domain.hostname, domain.token)) return { ...keep, attempts: 0 };
    const attempts = domain.attempts + 1;
    return attempts >= limits.lapseAttempts ? { ...keep, state: DOMAIN_STATE.suspended, attempts, error: DOMAIN_ERROR.txtMissing, release: true } : { ...keep, attempts, error: DOMAIN_ERROR.txtMissing };
  }
  return keep;
}

/** The DNS instructions shown to the merchant: the TXT record and the CNAME to the edge. */
export function dnsInstructions(hostname: string, token: string, edgeTarget: string): { txt: { name: string; value: string }; cname: { name: string; value: string } } {
  return { txt: { name: txtRecordName(hostname), value: txtRecordValue(token) }, cname: { name: hostname, value: edgeTarget } };
}

const TOKEN_BYTES = 24;
/** The token of a (shop, domain) pairing: random bytes in hex, never derived from the shop or the name (a released domain gets a new one). */
export function newDomainToken(random: (bytes: number) => Uint8Array): string {
  return Array.from(random(TOKEN_BYTES), (b) => b.toString(16).padStart(2, "0")).join("");
}
