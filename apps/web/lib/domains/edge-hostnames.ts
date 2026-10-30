import type { CustomHostnames, HostnameReport, TlsStatus, TxtResolver } from "@akinaza/core";

type Vars = Record<string, string | undefined>;

/** The certificate states the edge service reports, read as ours (ADR-005 §3). Anything not known to be final stays pending: never a guess towards « active ». */
const FAILED = new Set(["validation_timed_out", "issuance_timed_out", "deleted", "pending_deletion", "blocked", "moved"]);
export function tlsOf(status: string | undefined): TlsStatus {
  if (status === "active") return "active";
  return status && FAILED.has(status) ? "failed" : "pending";
}

interface EdgeResult {
  id: string;
  status?: string;
  ssl?: { status?: string; validation_errors?: { message?: string }[] };
  verification_errors?: string[];
}
const reportOf = (r: EdgeResult): HostnameReport => {
  const certificate = tlsOf(r.ssl?.status ?? r.status);
  // The hostname itself must be live too: a certificate alone never makes it active.
  const tls = certificate === "active" && tlsOf(r.status) !== "active" ? "pending" : certificate;
  const error = r.verification_errors?.[0] ?? r.ssl?.validation_errors?.[0]?.message;
  return error ? { id: r.id, tls, error } : { id: r.id, tls };
};

/** The custom-hostname API of the edge service, called with a token and a zone from the configuration (the vendor is `APP_EDGE_PROVIDER`). */
function remoteHostnames(vars: Vars, fetcher: typeof fetch): CustomHostnames {
  const base = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(vars.APP_EDGE_ZONE_ID ?? "")}/custom_hostnames`;
  const call = async (path: string, init: RequestInit = {}): Promise<EdgeResult> => {
    const res = await fetcher(base + path, { ...init, headers: { authorization: `Bearer ${vars.APP_EDGE_API_TOKEN ?? ""}`, "content-type": "application/json" }, signal: AbortSignal.timeout(10_000) });
    const body = (await res.json()) as { success?: boolean; result?: EdgeResult };
    if (!res.ok || !body.success || !body.result) throw new Error(`edge ${res.status}`);
    return body.result;
  };
  return {
    create: async (hostname) => reportOf(await call("", { method: "POST", body: JSON.stringify({ hostname, ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } } }) })),
    status: async (id) => reportOf(await call(`/${encodeURIComponent(id)}`)),
    remove: async (id) => {
      await call(`/${encodeURIComponent(id)}`, { method: "DELETE" }).catch((): null => null);
    },
  };
}

/** Development and tests only: a hostname is certified at once and the TXT is read from the proof the harness leaves in memory. Refused in production. */
export function memoryEdge(): { hostnames: CustomHostnames; dns: TxtResolver; prove: (name: string, value: string) => void } {
  const records = new Map<string, string[]>();
  return {
    hostnames: { create: async (h) => ({ id: `mem_${h}`, tls: "active" }), status: async (id) => ({ id, tls: "active" }), remove: async () => undefined },
    dns: { txt: async (name) => records.get(name) ?? [] },
    prove: (name, value) => {
      records.set(name, [value]);
    },
  };
}

export const DEFAULT_EDGE_TARGET = "edge.akinaza.shop";

/** Where merchants point their CNAME. */
export const edgeTarget = (vars: Vars): string => vars.APP_EDGE_CNAME_TARGET?.trim().toLowerCase() || DEFAULT_EDGE_TARGET;

/** The edge service, or null when none is configured (the option then cannot be used: the owner's page says so). */
export function edgeHostnames(vars: Vars, fetcher: typeof fetch = fetch): CustomHostnames | null {
  if (vars.APP_EDGE_PROVIDER === "cloudflare" && vars.APP_EDGE_API_TOKEN && vars.APP_EDGE_ZONE_ID) return remoteHostnames(vars, fetcher);
  if (vars.APP_EDGE_PROVIDER === "memory" && vars.NODE_ENV !== "production") return harness.hostnames;
  return null;
}

const harness = memoryEdge();
/** The harness's records, written by a test that plays the merchant's DNS. */
export const proveInMemory = harness.prove;
export const harnessDns = harness.dns;
