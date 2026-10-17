import { canonicalHours, ConnectorError, diffProfiles, hoursToWindows, type Platform, plan, type Profile, type RetryOptions, sanitizeProfile, scrub, type SocialConnector, SYNC_FIELDS, type SyncField, type Tokens, withRetry } from "@akinaza/core";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db, Tx } from "./client";
import { openField, sealField } from "./crypto";
import { schedules, shops, socialConnections, staff, syncLog, syncProposalItems, syncProposals } from "./schema";
import { ShopError } from "./service-shop";

/**
 * Social and listings sync (ADR-002). Akinaza is the source of truth; a pull is a proposal the owner decides field by
 * field; a push never overwrites an undecided difference; every step is logged per field, with nothing secret in it.
 * Tokens are sealed with the application's key (the shop and the platform as authenticated data) and are opened only here.
 */

/** The version of the words shown when an owner connects an account (Loi 25: the decision is tied to what was read). */
export const SYNC_CONSENT_TEXT_VERSION = "2026-10-17";

const Status = { Disconnected: "disconnected", NeedsReconnect: "needs_reconnect" } as const;
const AUTH_FAILURE = "auth";
const INVALID_FAILURE = "invalid";

const refuse = (code: string): never => {
  throw new ShopError(code);
};
const aad = (shopId: string, platform: Platform) => `social:${shopId}:${platform}`;
const dataTime = (now: Date) => now;

export type SyncClock = { now: Date } & RetryOptions;

async function writeLog(tx: Db | Tx, shopId: string, platform: Platform, entry: { field?: SyncField | null; direction: "pull" | "push" | "connection"; outcome: (typeof syncLog.$inferInsert)["outcome"]; detail?: unknown }, secrets: readonly string[] = []) {
  await tx.insert(syncLog).values({ shopId, platform, field: entry.field ?? null, direction: entry.direction, outcome: entry.outcome, detail: scrub(entry.detail ?? {}, secrets) as Record<string, unknown> });
}

async function connectionRow(db: Db | Tx, shopId: string, platform: Platform) {
  const [row] = await db.select().from(socialConnections).where(and(eq(socialConnections.shopId, shopId), eq(socialConnections.platform, platform)));
  return row ?? null;
}

/** The decrypted tokens of a connected account. Server side only; never returned to a client, never logged. */
export async function openSocialTokens(db: Db | Tx, key: Buffer, shopId: string, platform: Platform): Promise<Tokens> {
  const row = await connectionRow(db, shopId, platform);
  if (!row || row.status === Status.Disconnected || !row.tokenEnc) return refuse("AK_SYNC_NOT_CONNECTED");
  return JSON.parse(openField(row.tokenEnc, key, aad(shopId, platform))) as Tokens;
}

const secretsOf = (t: Tokens) => [t.accessToken, ...(t.refreshToken ? [t.refreshToken] : [])];

/** Runs a connector call with retry; turns its failure into the refusal the owner sees, and records it (secrets masked). */
async function guarded<T>(db: Db, shopId: string, platform: Platform, direction: "pull" | "push" | "connection", tokens: Tokens | null, clock: RetryOptions, run: () => Promise<T>): Promise<T> {
  try {
    return await withRetry(run, clock);
  } catch (error) {
    const kind = error instanceof ConnectorError ? error.kind : "transient";
    const message = error instanceof Error ? error.message : "unknown";
    await writeLog(db, shopId, platform, { direction, outcome: "failed", detail: { kind, message } }, tokens ? secretsOf(tokens) : []);
    await db.update(socialConnections).set({ lastErrorCode: kind, ...(kind === AUTH_FAILURE && tokens ? { status: "needs_reconnect" as const } : {}) }).where(and(eq(socialConnections.shopId, shopId), eq(socialConnections.platform, platform)));
    if (kind === AUTH_FAILURE) return refuse(tokens ? "AK_SYNC_RECONNECT" : "AK_SYNC_INVALID");
    if (kind === INVALID_FAILURE) return refuse("AK_SYNC_INVALID");
    return refuse("AK_SYNC_UNAVAILABLE");
  }
}

/** Connects (second half of OAuth: the code the platform sent back). Needs the owner's explicit consent. */
export async function connectPlatform(db: Db, key: Buffer, connector: SocialConnector, input: { shopId: string; code: string; consent: boolean } & RetryOptions): Promise<void> {
  if (!input.consent) refuse("AK_SYNC_NO_CONSENT");
  const platform = connector.platform;
  const tokens = await guarded(db, input.shopId, platform, "connection", null, input, () => connector.exchange({ code: input.code, shopKey: input.shopId.slice(0, 8) }));
  const values = {
    status: "connected" as const,
    externalId: tokens.externalId ?? null,
    externalLabel: tokens.externalLabel ?? null,
    scopes: tokens.scopes ?? [],
    tokenEnc: sealField(JSON.stringify(tokens), key, aad(input.shopId, platform)),
    consentTextVersion: SYNC_CONSENT_TEXT_VERSION,
    consentedAt: sql`now()`,
    connectedAt: sql`now()`,
    lastErrorCode: null,
  };
  await db.transaction(async (tx) => {
    await tx.insert(socialConnections).values({ shopId: input.shopId, platform, ...values }).onConflictDoUpdate({ target: [socialConnections.shopId, socialConnections.platform], set: values });
    await writeLog(tx, input.shopId, platform, { direction: "connection", outcome: "connected", detail: { scopes: tokens.scopes ?? [], consentTextVersion: SYNC_CONSENT_TEXT_VERSION } }, secretsOf(tokens));
  });
}

/** Revokes at the platform (best effort), wipes the token, forgets the account, drops the open proposal. */
export async function disconnectPlatform(db: Db, key: Buffer, connector: SocialConnector, input: { shopId: string }): Promise<void> {
  const platform = connector.platform;
  const row = await connectionRow(db, input.shopId, platform);
  if (!row || row.status === Status.Disconnected) return;
  let revoked = true;
  let secrets: string[] = [];
  if (row.tokenEnc) {
    const tokens = JSON.parse(openField(row.tokenEnc, key, aad(input.shopId, platform))) as Tokens;
    secrets = secretsOf(tokens);
    try {
      await connector.revoke(tokens);
    } catch {
      revoked = false; // the owner can still revoke from the platform's own settings; our copy is wiped regardless
    }
  }
  await db.transaction(async (tx) => {
    await tx.update(socialConnections).set({ status: "disconnected", tokenEnc: null, externalId: null, externalLabel: null, scopes: [], lastErrorCode: null }).where(eq(socialConnections.id, row.id));
    await tx.update(syncProposals).set({ status: "superseded" }).where(and(eq(syncProposals.shopId, input.shopId), eq(syncProposals.platform, platform), eq(syncProposals.status, "open")));
    await writeLog(tx, input.shopId, platform, { direction: "connection", outcome: "disconnected", detail: { revokedAtPlatform: revoked } }, secrets);
  });
}

/** What the screen shows of the connections: never a token. */
export async function syncConnections(db: Db, shopId: string) {
  const rows = await db.select().from(socialConnections).where(eq(socialConnections.shopId, shopId)).orderBy(asc(socialConnections.platform));
  return rows.map((r) => ({ platform: r.platform, status: r.status, externalLabel: r.externalLabel, scopes: r.scopes, connectedAt: r.connectedAt, consentedAt: r.consentedAt, lastSyncAt: r.lastSyncAt, lastErrorCode: r.lastErrorCode }));
}

/** The storefront's syncable facts. The description is the French bio (the shop's first language). */
export async function localProfile(db: Db | Tx, shopId: string): Promise<Profile> {
  const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  const member = await ownerStaff(db, shopId);
  const windows = member ? await db.select().from(schedules).where(eq(schedules.staffId, member.id)) : [];
  return { hours: canonicalHours(windows), description: shop.bioFr ?? "", phone: shop.publicPhone ?? "", email: shop.publicEmail ?? "", website: shop.publicWebsite ?? "" };
}

async function ownerStaff(db: Db | Tx, shopId: string) {
  const [member] = await db.select().from(staff).where(and(eq(staff.shopId, shopId), eq(staff.active, true))).orderBy(asc(staff.name)).limit(1);
  return member ?? null;
}

const pendingFields = async (db: Db | Tx, shopId: string, platform: Platform): Promise<Set<SyncField>> => {
  const rows = await db
    .select({ field: syncProposalItems.field })
    .from(syncProposalItems)
    .innerJoin(syncProposals, eq(syncProposals.id, syncProposalItems.proposalId))
    .where(and(eq(syncProposals.shopId, shopId), eq(syncProposals.platform, platform), eq(syncProposals.status, "open"), eq(syncProposalItems.decision, "pending")));
  return new Set(rows.map((r) => r.field));
};

const keptFields = async (db: Db | Tx, shopId: string, platform: Platform): Promise<Set<SyncField>> => {
  const rows = await db
    .select({ field: syncProposalItems.field })
    .from(syncProposalItems)
    .innerJoin(syncProposals, eq(syncProposals.id, syncProposalItems.proposalId))
    .where(and(eq(syncProposals.shopId, shopId), eq(syncProposals.platform, platform), eq(syncProposalItems.decision, "keep"), isNull(syncProposalItems.pushedAt)));
  return new Set(rows.map((r) => r.field));
};

async function liveConnection(db: Db, shopId: string, platform: Platform) {
  const row = await connectionRow(db, shopId, platform);
  if (!row || row.status === Status.Disconnected) return refuse("AK_SYNC_NOT_CONNECTED");
  if (row.status === Status.NeedsReconnect) return refuse("AK_SYNC_RECONNECT");
  return row;
}

/** Reads the platform's profile and stores the differences as a proposal (replacing an older open one). Nothing is applied. */
export async function pullProposal(db: Db, key: Buffer, connector: SocialConnector, input: { shopId: string } & SyncClock): Promise<{ proposalId: string | null; needsDecision: SyncField[] }> {
  const platform = connector.platform;
  await liveConnection(db, input.shopId, platform);
  const tokens = await openSocialTokens(db, key, input.shopId, platform);
  const remote = sanitizeProfile(await guarded(db, input.shopId, platform, "pull", tokens, input, () => connector.pull(tokens)));
  const local = await localProfile(db, input.shopId);
  const kept = await keptFields(db, input.shopId, platform);
  const proposed = plan(diffProfiles(platform, local, remote), new Set(), kept).propose;
  return db.transaction(async (tx) => {
    await tx.update(syncProposals).set({ status: "superseded" }).where(and(eq(syncProposals.shopId, input.shopId), eq(syncProposals.platform, platform), eq(syncProposals.status, "open")));
    await tx.update(socialConnections).set({ lastSyncAt: dataTime(input.now), lastErrorCode: null }).where(and(eq(socialConnections.shopId, input.shopId), eq(socialConnections.platform, platform)));
    if (proposed.length === 0) return { proposalId: null, needsDecision: [] };
    const [proposal] = await tx.insert(syncProposals).values({ shopId: input.shopId, platform }).returning({ id: syncProposals.id });
    await tx.insert(syncProposalItems).values(proposed.map((d) => ({ proposalId: proposal!.id, field: d.field, state: d.state as "changed" | "remote_only" | "local_only", localValue: d.local ?? null, remoteValue: d.remote ?? null })));
    for (const d of proposed) await writeLog(tx, input.shopId, platform, { field: d.field, direction: "pull", outcome: "proposed", detail: { state: d.state } }, secretsOf(tokens));
    return { proposalId: proposal!.id, needsDecision: proposed.map((d) => d.field) };
  });
}

export const decisionInputSchema = z.object({ field: z.enum(SYNC_FIELDS), decision: z.enum(["accept", "keep"]) });
export type DecisionInput = z.input<typeof decisionInputSchema>;

/** Writes one accepted platform value into the storefront. */
async function applyRemote(tx: Tx, shopId: string, field: SyncField, value: unknown): Promise<void> {
  if (field === "hours") {
    const member = await ownerStaff(tx, shopId);
    if (!member) return refuse("AK_STAFF_UNKNOWN");
    await tx.delete(schedules).where(eq(schedules.staffId, member.id));
    const windows = hoursToWindows((value ?? {}) as Profile["hours"] & object);
    if (windows.length) await tx.insert(schedules).values(windows.map((w) => ({ staffId: member.id, weekday: w.weekday, startsAt: w.startsAt, endsAt: w.endsAt })));
    return;
  }
  const text = typeof value === "string" ? value : "";
  const column = { description: { bioFr: text || null }, phone: { publicPhone: text || null }, email: { publicEmail: text || null }, website: { publicWebsite: text || null } }[field];
  await tx.update(shops).set(column).where(eq(shops.id, shopId));
}

/** The owner's decisions on a proposal's fields: `accept` takes the platform's value, `keep` keeps Akinaza's for the next push. */
export async function decideProposal(db: Db, input: { shopId: string; proposalId: string; decisions: DecisionInput[] }): Promise<void> {
  const decisions = input.decisions.map((d) => decisionInputSchema.parse(d));
  await db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(syncProposals).where(and(eq(syncProposals.id, input.proposalId), eq(syncProposals.shopId, input.shopId), eq(syncProposals.status, "open"))).for("update");
    if (!proposal) return refuse("AK_SYNC_PROPOSAL_UNKNOWN");
    const items = await tx.select().from(syncProposalItems).where(eq(syncProposalItems.proposalId, proposal.id));
    for (const d of decisions) {
      const item = items.find((i) => i.field === d.field);
      if (!item || item.decision !== "pending") return refuse("AK_SYNC_INVALID");
      if (d.decision === "accept") await applyRemote(tx, input.shopId, d.field, item.remoteValue);
      await tx.update(syncProposalItems).set({ decision: d.decision }).where(eq(syncProposalItems.id, item.id));
      await writeLog(tx, input.shopId, proposal.platform, { field: d.field, direction: "pull", outcome: d.decision === "accept" ? "accepted" : "kept_local" });
    }
    const [left] = await tx.select({ n: sql<number>`count(*)::int` }).from(syncProposalItems).where(and(eq(syncProposalItems.proposalId, proposal.id), eq(syncProposalItems.decision, "pending")));
    if (left!.n === 0) await tx.update(syncProposals).set({ status: "decided", decidedAt: sql`now()` }).where(eq(syncProposals.id, proposal.id));
  });
}

/** The open proposals, with their fields, for the screen. */
export async function openProposals(db: Db, shopId: string) {
  const proposals = await db.select().from(syncProposals).where(and(eq(syncProposals.shopId, shopId), eq(syncProposals.status, "open"))).orderBy(desc(syncProposals.createdAt));
  if (proposals.length === 0) return [];
  const items = await db.select().from(syncProposalItems).where(inArray(syncProposalItems.proposalId, proposals.map((p) => p.id)));
  return proposals.map((p) => ({ id: p.id, platform: p.platform, createdAt: p.createdAt, items: items.filter((i) => i.proposalId === p.id).map((i) => ({ field: i.field, state: i.state, localValue: i.localValue, remoteValue: i.remoteValue, decision: i.decision })) }));
}

/**
 * Sends Akinaza's values: what only Akinaza has, and what the owner chose to keep. A difference nobody decided yet is
 * never overwritten (it is reported as `needsDecision`).
 */
export async function pushChanges(db: Db, key: Buffer, connector: SocialConnector, input: { shopId: string } & SyncClock): Promise<{ pushed: SyncField[]; skipped: { field: SyncField; reason: string }[]; needsDecision: SyncField[] }> {
  const platform = connector.platform;
  await liveConnection(db, input.shopId, platform);
  const tokens = await openSocialTokens(db, key, input.shopId, platform);
  const remote = sanitizeProfile(await guarded(db, input.shopId, platform, "pull", tokens, input, () => connector.pull(tokens)));
  const local = await localProfile(db, input.shopId);
  const pending = await pendingFields(db, input.shopId, platform);
  const kept = await keptFields(db, input.shopId, platform);
  const { propose, push, skipped } = plan(diffProfiles(platform, local, remote), pending, kept);
  const values: Profile = {};
  for (const d of push) (values as Record<string, unknown>)[d.field] = d.local;
  if (push.length) await guarded(db, input.shopId, platform, "push", tokens, input, () => connector.push(tokens, values));
  await db.transaction(async (tx) => {
    for (const d of push) await writeLog(tx, input.shopId, platform, { field: d.field, direction: "push", outcome: "pushed" }, secretsOf(tokens));
    for (const s of skipped) await writeLog(tx, input.shopId, platform, { field: s.field, direction: "push", outcome: "skipped", detail: { reason: s.reason } });
    if (push.length) {
      const open = tx.select({ id: syncProposals.id }).from(syncProposals).where(and(eq(syncProposals.shopId, input.shopId), eq(syncProposals.platform, platform)));
      await tx.update(syncProposalItems).set({ pushedAt: dataTime(input.now) }).where(and(inArray(syncProposalItems.proposalId, open), eq(syncProposalItems.decision, "keep"), isNull(syncProposalItems.pushedAt), inArray(syncProposalItems.field, push.map((d) => d.field))));
    }
    await tx.update(socialConnections).set({ lastSyncAt: dataTime(input.now), lastErrorCode: null }).where(and(eq(socialConnections.shopId, input.shopId), eq(socialConnections.platform, platform)));
  });
  return { pushed: push.map((d) => d.field), skipped, needsDecision: [...new Set([...pending, ...propose.map((d) => d.field)])] };
}

/** The most recent entries, newest first: what the owner reads as « what happened ». */
export async function syncLogOf(db: Db, shopId: string, limit = 30) {
  return db.select().from(syncLog).where(eq(syncLog.shopId, shopId)).orderBy(desc(syncLog.id)).limit(limit);
}
