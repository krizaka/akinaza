import { ConnectorError, FakeConnector } from "@akinaza/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseDataKey } from "./crypto";
import { schedules, shops, socialConnections, syncLog } from "./schema";
import { saveShopPage, ShopError } from "./service-shop";
import { connectPlatform, decideProposal, disconnectPlatform, openProposals, pullProposal, pushChanges, SYNC_CONSENT_TEXT_VERSION, syncConnections, syncLogOf } from "./social-sync";
import { freshDatabase, refusal } from "./test/db";
import { NOW, walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const key = parseDataKey(Buffer.alloc(32, 7).toString("base64"));
const instant = { sleep: async () => {}, random: () => 1 };

/** A walker with hours 09–12 Mon–Fri, a connected fake Google account whose profile says 09–17. */
async function connected(tag: string, platform: "google" | "facebook" = "google") {
  const w = await walkerShop(t.db, tag);
  const fake = new FakeConnector(platform);
  await connectPlatform(t.db, key, fake, { shopId: w.shopId, code: "fake-code", consent: true });
  return { w, fake };
}
const tokenOf = async (shopId: string) => {
  const [row] = await t.db.select().from(socialConnections).where(eq(socialConnections.shopId, shopId));
  return row!;
};

describe("connecting", () => {
  it("needs the owner's explicit consent, and records the version of the words", async () => {
    const w = await walkerShop(t.db, "sc1");
    expect((await refusal(connectPlatform(t.db, key, new FakeConnector("google"), { shopId: w.shopId, code: "fake-code", consent: false })))).toContain("AK_SYNC_NO_CONSENT");
    await connectPlatform(t.db, key, new FakeConnector("google"), { shopId: w.shopId, code: "fake-code", consent: true });
    const [row] = await t.db.select().from(socialConnections).where(eq(socialConnections.shopId, w.shopId));
    expect(row).toMatchObject({ status: "connected", consentTextVersion: SYNC_CONSENT_TEXT_VERSION });
  });

  it("keeps the token sealed at rest and gives the screen no token at all", async () => {
    const { w } = await connected("sc2");
    const row = await tokenOf(w.shopId);
    expect(row.tokenEnc).toMatch(/^v1\./);
    expect(row.tokenEnc).not.toContain("fake-access");
    const view = await syncConnections(t.db, w.shopId);
    expect(JSON.stringify(view)).not.toMatch(/fake-access|fake-refresh|token/i);
    expect(view.find((c) => c.platform === "google")).toMatchObject({ status: "connected", externalLabel: "Fake google page" });
  });

  it("refuses a bad authorization code without storing anything", async () => {
    const w = await walkerShop(t.db, "sc3");
    await expect(connectPlatform(t.db, key, new FakeConnector("google"), { shopId: w.shopId, code: "nope", consent: true })).rejects.toBeInstanceOf(ShopError);
    expect(await t.db.select().from(socialConnections).where(eq(socialConnections.shopId, w.shopId))).toHaveLength(0);
  });
});

describe("importing as a proposal", () => {
  it("proposes the differences field by field and changes nothing until the owner decides", async () => {
    const { w, fake } = await connected("sp1");
    const before = (await t.db.select().from(shops).where(eq(shops.id, w.shopId)))[0]!;
    const { proposalId, needsDecision } = await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    expect(proposalId).toBeTruthy();
    expect(needsDecision.sort()).toEqual(["description", "hours", "phone", "website"]);
    const [proposal] = await openProposals(t.db, w.shopId);
    const hours = proposal!.items.find((i) => i.field === "hours")!;
    expect(hours).toMatchObject({ state: "changed", decision: "pending" });
    expect(JSON.stringify(hours.localValue)).toContain("12:00");
    expect(JSON.stringify(hours.remoteValue)).toContain("17:00");
    expect((await t.db.select().from(shops).where(eq(shops.id, w.shopId)))[0]).toEqual(before);
  });

  it("applies the accepted fields (the hours replace the weekly schedule) and keeps Akinaza's for the rest", async () => {
    const { w, fake } = await connected("sp2");
    const { proposalId } = await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    await decideProposal(t.db, { shopId: w.shopId, proposalId: proposalId!, decisions: [{ field: "hours", decision: "accept" }, { field: "phone", decision: "accept" }, { field: "website", decision: "accept" }, { field: "description", decision: "keep" }] });
    const shop = (await t.db.select().from(shops).where(eq(shops.id, w.shopId)))[0]!;
    expect(shop).toMatchObject({ publicPhone: "(514) 555-0123", publicWebsite: "https://pattes.example.test/", bioFr: null });
    const windows = await t.db.select().from(schedules);
    const mine = windows.filter((x) => x.startsAt === "09:00:00" && x.endsAt === "17:00:00");
    expect(mine.length).toBeGreaterThanOrEqual(5);
    expect(await openProposals(t.db, w.shopId)).toHaveLength(0);
  });

  it("logs every decision per field", async () => {
    const { w, fake } = await connected("sp3");
    const { proposalId } = await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    await decideProposal(t.db, { shopId: w.shopId, proposalId: proposalId!, decisions: [{ field: "phone", decision: "accept" }, { field: "website", decision: "keep" }] });
    const log = await syncLogOf(t.db, w.shopId);
    expect(log.filter((l) => l.outcome === "proposed").map((l) => l.field).sort()).toEqual(["description", "hours", "phone", "website"]);
    expect(log.find((l) => l.field === "phone")).toMatchObject({ outcome: "accepted", platform: "google" });
    expect(log.find((l) => l.field === "website" && l.outcome === "kept_local")).toBeTruthy();
  });

  it("replaces an older open proposal with a fresh one", async () => {
    const { w, fake } = await connected("sp4");
    const first = await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    const second = await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    expect(second.proposalId).not.toBe(first.proposalId);
    expect(await openProposals(t.db, w.shopId)).toHaveLength(1);
  });

  it("cannot decide another shop's proposal", async () => {
    const a = await connected("sp5");
    const b = await walkerShop(t.db, "sp5b");
    const { proposalId } = await pullProposal(t.db, key, a.fake, { shopId: a.w.shopId, now: NOW, ...instant });
    expect(await refusal(decideProposal(t.db, { shopId: b.shopId, proposalId: proposalId!, decisions: [{ field: "phone", decision: "accept" }] }))).toContain("AK_SYNC_PROPOSAL_UNKNOWN");
  });
});

describe("publishing", () => {
  it("sends what only Akinaza has, and leaves an undecided difference alone", async () => {
    const { w, fake } = await connected("pu1");
    await saveShopPage(t.db, w.owner.id, { name: "Pattes", legalName: "Pattes", address: "1 rue Test", slug: "pattes-pu1", ownerName: "Mathilde", published: true, publicEmail: "bonjour@pattes.test", bioFr: "Mon texte" });
    await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    const result = await pushChanges(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    expect(result.pushed).toEqual([]); // google maps no e-mail; description / phone / hours / website are undecided
    expect(result.needsDecision).toContain("description");
  });

  it("sends Akinaza's value once the owner kept it, and the platform then agrees", async () => {
    const { w, fake } = await connected("pu2");
    await saveShopPage(t.db, w.owner.id, { name: "Pattes", legalName: "Pattes", address: "1 rue Test", slug: "pattes-pu2", ownerName: "Mathilde", published: true, bioFr: "Mon texte", publicPhone: "514-555-0100" });
    const { proposalId } = await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    await decideProposal(t.db, { shopId: w.shopId, proposalId: proposalId!, decisions: [{ field: "description", decision: "keep" }, { field: "phone", decision: "keep" }, { field: "hours", decision: "keep" }, { field: "website", decision: "accept" }] });
    const result = await pushChanges(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    expect(result.pushed.sort()).toEqual(["description", "hours", "phone"]);
    const remote = await fake.pull(await openTokens(w.shopId));
    expect(remote.description).toBe("Mon texte");
    expect(remote.hours?.[1]).toEqual([{ startsAt: "09:00", endsAt: "12:00" }]);
    const again = await pushChanges(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant });
    expect(again.pushed).toEqual([]); // nothing left to send
    expect((await syncLogOf(t.db, w.shopId)).filter((l) => l.outcome === "pushed").map((l) => l.field).sort()).toEqual(["description", "hours", "phone"]);
  });

  it("retries a rate limit and then succeeds", async () => {
    const { w, fake } = await connected("pu3");
    fake.failures = [new ConnectorError("rate_limited", "slow", { retryAfterMs: 1 })];
    const waits: number[] = [];
    const out = await pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, sleep: async (ms) => { waits.push(ms); }, random: () => 1 });
    expect(out.proposalId).toBeTruthy();
    expect(waits).toEqual([1]);
  });

  it("answers unavailable when the platform keeps failing, and says so in the log", async () => {
    const { w, fake } = await connected("pu4");
    fake.failures = [1, 2, 3].map(() => new ConnectorError("transient", "503"));
    expect(await refusal(pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant }))).toContain("AK_SYNC_UNAVAILABLE");
    expect((await syncLogOf(t.db, w.shopId)).find((l) => l.outcome === "failed")).toMatchObject({ direction: "pull" });
  });
});

describe("revocation and secrets", () => {
  it("asks to reconnect when the owner revoked access at the platform, and the log never holds the token", async () => {
    const { w, fake } = await connected("rv1");
    const tokens = await openTokens(w.shopId);
    await fake.revoke(tokens);
    expect(await refusal(pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant }))).toContain("AK_SYNC_RECONNECT");
    expect((await syncConnections(t.db, w.shopId)).find((c) => c.platform === "google")).toMatchObject({ status: "needs_reconnect", lastErrorCode: "auth" });
    const everything = JSON.stringify(await t.db.select().from(syncLog).where(eq(syncLog.shopId, w.shopId))) + JSON.stringify(await syncConnections(t.db, w.shopId));
    expect(everything).not.toContain(tokens.accessToken);
    expect(everything).not.toContain(tokens.refreshToken!);
  });

  it("disconnects: revokes at the platform, wipes the token, and refuses further sync", async () => {
    const { w, fake } = await connected("rv2");
    const tokens = await openTokens(w.shopId);
    await disconnectPlatform(t.db, key, fake, { shopId: w.shopId });
    const row = await tokenOf(w.shopId);
    expect(row).toMatchObject({ status: "disconnected", tokenEnc: null, externalId: null });
    await expect(fake.pull(tokens)).rejects.toMatchObject({ kind: "auth" });
    expect(await refusal(pullProposal(t.db, key, fake, { shopId: w.shopId, now: NOW, ...instant }))).toContain("AK_SYNC_NOT_CONNECTED");
    expect((await syncLogOf(t.db, w.shopId)).some((l) => l.outcome === "disconnected")).toBe(true);
  });

  it("the sync log is append-only", async () => {
    const { w } = await connected("rv3");
    expect(await refusal(t.pool.query("UPDATE sync_log SET outcome = 'failed' WHERE shop_id = $1", [w.shopId]))).toContain("AK_WRITTEN_ONCE");
  });

  it("the database refuses a connected row without a token", async () => {
    const w = await walkerShop(t.db, "rv4");
    expect(await refusal(t.db.insert(socialConnections).values({ shopId: w.shopId, platform: "google", status: "connected", consentTextVersion: "x" }))).toMatch(/social_connections_token|check/);
  });
});

async function openTokens(shopId: string) {
  const { openSocialTokens } = await import("./social-sync");
  return openSocialTokens(t.db, key, shopId, "google");
}
