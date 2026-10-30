import { randomBytes } from "node:crypto";

import { dnsInstructions,type DomainState } from "@akinaza/core";
import { addShopDomain, checkShopDomainNow, domainsOverview, listShopDomains, removeShopDomain, retryShopDomain, setCustomDomainOption } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { refuse } from "@/lib/http";
import { appPrices } from "@/lib/price-catalogue";
import { CUSTOM_DOMAIN } from "@/lib/pricing";

import { edgeHostnames, edgeTarget } from "./edge-hostnames";
import { domainPorts } from "./ports";

type Actor = { actorId: string; actorLabel: string; headers: Headers };

// @fixed: the owner's « check now » waits this long between two checks of the same domain, in milliseconds (verification retries are limited, ADR-005 §8)
const CHECK_NOW_MS = 30_000;
const vars = (): Record<string, string | undefined> => process.env;

/** The paid add-on as the catalogue has it today: the version to record on the shop and its per-shop limit. Null while no price is in force (nothing is enabled free by accident). */
export async function customDomainAddon(now = systemClock.now()): Promise<{ priceVersion: string; maxDomains: number; amountCents: number } | null> {
  const entry = (await appPrices().catalogue(now)).find((e) => e.key === CUSTOM_DOMAIN);
  if (!entry || entry.amountCents === null) return null;
  return { priceVersion: entry.versionId, maxDomains: entry.limits.maxDomains ?? 1, amountCents: entry.amountCents };
}

export interface OwnerDomain {
  id: string;
  hostname: string;
  state: DomainState;
  error: string | null;
  records: { txt: { name: string; value: string }; cname: { name: string; value: string } };
}
export interface OwnerDomains {
  enabled: boolean;
  /** No edge service is configured on this deployment: the page says it is not available yet. */
  available: boolean;
  max: number;
  domains: OwnerDomain[];
}

export async function ownerDomains(shopId: string, enabled: boolean): Promise<OwnerDomains> {
  const addon = await customDomainAddon();
  const rows = await listShopDomains(db(), shopId);
  return {
    enabled,
    available: edgeHostnames(vars()) !== null,
    max: addon?.maxDomains ?? 0,
    domains: rows.map((d) => ({ id: d.id, hostname: d.hostname, state: d.state, error: d.lastError, records: dnsInstructions(d.hostname, d.token, edgeTarget(vars())) })),
  };
}

export async function addOwnerDomain(shopId: string, hostname: string, who: Actor) {
  const addon = await customDomainAddon();
  const row = await addShopDomain(db(), shopId, hostname, { max: addon?.maxDomains ?? 0, random: (n) => randomBytes(n) });
  await audit({ ...who, action: "domain.add", targetId: row.id, detail: { shopId, hostname: row.hostname } });
  return row;
}

export async function checkOwnerDomain(shopId: string, domainId: string) {
  const ports = domainPorts(vars(), systemClock.now());
  if (!ports) throw refuse(503, "EDGE_UNAVAILABLE", "Custom domains are not available on this deployment yet");
  return checkShopDomainNow(db(), shopId, domainId, ports, CHECK_NOW_MS);
}

export const retryOwnerDomain = (shopId: string, domainId: string) => retryShopDomain(db(), shopId, domainId, systemClock.now());

async function releaseAtEdge(ids: string[]) {
  const edge = edgeHostnames(vars());
  if (edge) await Promise.all(ids.map((id) => edge.remove(id).catch((): void => undefined)));
}

/** Removes a domain (the owner's, or an administrator's revoke): it stops being served at once, then it is released at the edge. */
export async function removeDomain(shopId: string, domainId: string, who: Actor & { action: "domain.remove" | "domain.revoke" }) {
  const removed = await removeShopDomain(db(), shopId, domainId, systemClock.now());
  await releaseAtEdge(removed.release ? [removed.release] : []);
  await audit({ actorId: who.actorId, actorLabel: who.actorLabel, headers: who.headers, action: who.action, targetId: domainId, detail: { shopId, hostname: removed.hostname } });
}

/** An administrator switches the paid option for a shop. Enabling needs a price in force (its version is recorded on the shop); both ways are audited. */
export async function setOption(shopId: string, enabled: boolean, who: Actor) {
  const addon = enabled ? await customDomainAddon() : null;
  if (enabled && !addon) throw refuse(409, "PRICE_NOT_SET", "Schedule the price of the custom domain option in the catalogue first");
  const { release } = await setCustomDomainOption(db(), shopId, enabled, addon?.priceVersion ?? null, systemClock.now());
  await releaseAtEdge(release);
  await audit({ ...who, action: enabled ? "domain.option.enable" : "domain.option.disable", targetId: shopId, detail: { priceVersion: addon?.priceVersion ?? null } });
}

export const adminDomains = () => domainsOverview(db());
