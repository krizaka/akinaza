import type { CustomHostnames, DomainLimits } from "@akinaza/core";
import type { DomainPorts } from "@akinaza/db";

import { dnsOf } from "./dns-source";
import { edgeHostnames } from "./edge-hostnames";

/** How a domain waits: a check every few minutes, three days for the TXT and the certificate, three misses in a row before a live domain is suspended. */
// @fixed: the verification window is a technical fact of DNS propagation, not a price or a plan limit
export const DOMAIN_LIMITS: DomainLimits = { maxAttempts: 1000, lapseAttempts: 3, waitMs: 3 * 24 * 3600_000 };

/** The ports of a check, or null when no edge service is configured. */
export function domainPorts(vars: Record<string, string | undefined>, now: Date): DomainPorts | null {
  const hostnames: CustomHostnames | null = edgeHostnames(vars);
  return hostnames ? { dns: dnsOf(vars), hostnames, now, limits: DOMAIN_LIMITS } : null;
}
