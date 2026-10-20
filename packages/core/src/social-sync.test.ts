import { describe, expect, it } from "vitest";

import { canonicalHours, ConnectorError, diffProfiles, FIELD_MAPPINGS, FakeConnector, normalizePhone, normalizeWebsite, plan, retryDelayMs, sanitizeProfile, scrub, withRetry } from "./social-sync";

const hours = (start: string, end = "17:00") => canonicalHours([1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: start, endsAt: end })));

describe("hours, phone and website are compared in a canonical form", () => {
  it("merges back-to-back windows and ignores seconds", () => {
    expect(canonicalHours([{ weekday: 1, startsAt: "08:00:00", endsAt: "12:00:00" }, { weekday: 1, startsAt: "12:00", endsAt: "17:00" }])).toEqual({ 1: [{ startsAt: "08:00", endsAt: "17:00" }] });
  });
  it("treats formatting as no difference", () => {
    expect(normalizePhone("(514) 555-0100")).toBe(normalizePhone("+1 514.555.0100"));
    expect(normalizeWebsite("HTTPS://www.Pattes.test/")).toBe(normalizeWebsite("https://www.pattes.test"));
  });
});

describe("the field-by-field diff", () => {
  it("« Google says 9:00, Akinaza says 8:00 »: a changed field carries both values", () => {
    const d = diffProfiles("google", { hours: hours("08:00") }, { hours: hours("09:00") });
    expect(d.find((x) => x.field === "hours")).toMatchObject({ state: "changed", local: hours("08:00"), remote: hours("09:00") });
  });
  it("a formatting difference is not a difference", () => {
    const d = diffProfiles("google", { phone: "514-555-0100", website: "https://pattes.test" }, { phone: "(514) 555 0100", website: "https://pattes.test/" });
    expect(d.every((x) => x.state === "same")).toBe(true);
  });
  it("tells what exists on one side only", () => {
    const d = diffProfiles("google", { description: "Hello" }, { description: "", phone: "5145550100" });
    expect(d.find((x) => x.field === "description")).toMatchObject({ state: "local_only" });
    expect(d.find((x) => x.field === "phone")).toMatchObject({ state: "remote_only" });
  });
  it("skips a field the platform does not return or does not map", () => {
    const d = diffProfiles("instagram", { description: "Hello", phone: "5145550100" }, { description: "Other" });
    expect(d.map((x) => x.field)).not.toContain("phone");
    expect(FIELD_MAPPINGS.instagram.description?.direction).toBe("pull");
  });
});

describe("the plan: what is proposed, what is pushed", () => {
  const local = { description: "Mine", phone: "5145550100" };
  it("proposes what differs and may be pulled; pushes the rest", () => {
    const p = plan(diffProfiles("google", local, { description: "Theirs", phone: "5145550100", website: "https://theirs.test" }), new Set());
    expect(p.propose.map((x) => x.field).sort()).toEqual(["description", "website"]);
    expect(p.push).toEqual([]);
  });
  it("never pushes a field that has an undecided proposal", () => {
    const p = plan(diffProfiles("google", local, { description: "Theirs", phone: "5145550100" }), new Set(["description"]));
    expect(p.push.map((x) => x.field)).not.toContain("description");
  });
  it("pushes what only Akinaza has, and a differing field only once the owner kept it", () => {
    const p = plan(diffProfiles("google", local, { description: "", phone: "5145550100" }), new Set());
    expect(p.push.map((x) => x.field)).toEqual(["description"]);
    const kept = plan(diffProfiles("google", local, { description: "Theirs", phone: "5145550100" }), new Set(), new Set(["description"]));
    expect(kept.push.map((x) => x.field)).toEqual(["description"]);
    expect(kept.propose).toEqual([]);
  });
  it("skips a value longer than the platform allows, and says so", () => {
    const p = plan(diffProfiles("facebook", { description: "x".repeat(300) }, { description: "" }), new Set());
    expect(p.push).toEqual([]);
    expect(p.skipped).toEqual([{ field: "description", reason: "too_long" }]);
  });
});

describe("retry with backoff", () => {
  it("waits longer each time, with jitter, capped", () => {
    expect(retryDelayMs(1, () => 1)).toBeLessThan(retryDelayMs(3, () => 1));
    expect(retryDelayMs(30, () => 1)).toBeLessThanOrEqual(60_000);
    expect(retryDelayMs(2, () => 0)).toBe(0);
  });
  it("retries a rate limit after the delay the platform asked for, then succeeds", async () => {
    const waits: number[] = [];
    let calls = 0;
    const out = await withRetry(async () => { calls += 1; if (calls < 3) throw new ConnectorError("rate_limited", "slow down", { retryAfterMs: 2_000 }); return "ok"; }, { sleep: async (ms) => { waits.push(ms); }, random: () => 1 });
    expect(out).toBe("ok");
    expect(waits).toEqual([2_000, 2_000]);
  });
  it("gives up after the attempts", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls += 1; throw new ConnectorError("transient", "down"); }, { sleep: async () => {}, random: () => 1, maxAttempts: 3 })).rejects.toMatchObject({ kind: "transient" });
    expect(calls).toBe(3);
  });
  it("never retries an authentication or a validation error", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls += 1; throw new ConnectorError("auth", "revoked"); }, { sleep: async () => {}, random: () => 1 })).rejects.toMatchObject({ kind: "auth" });
    expect(calls).toBe(1);
  });
});

describe("scrub: a token is never in a log", () => {
  it("drops secret-looking keys and replaces known secrets inside strings, deeply", () => {
    const out = scrub({ field: "hours", access_token: "AAA", nested: { refreshToken: "BBB", msg: "failed with CCC in header" }, list: ["x CCC y"] }, ["CCC"]);
    const text = JSON.stringify(out);
    for (const secret of ["AAA", "BBB", "CCC"]) expect(text).not.toContain(secret);
    expect(out).toMatchObject({ field: "hours" });
  });
  it("a ConnectorError message never keeps the secret it was given", () => {
    expect(new ConnectorError("auth", "bad token tok_123", { secrets: ["tok_123"] }).message).not.toContain("tok_123");
  });
});

describe("the connector contract, on the fake", () => {
  it("connects, pulls, pushes, reports its status and, once revoked, refuses", async () => {
    const c = new FakeConnector("google");
    const tokens = await c.exchange({ code: "fake-code", shopKey: "s1" });
    expect(tokens.accessToken).toBeTruthy();
    const before = await c.pull(tokens);
    await c.push(tokens, { phone: "5145559999" });
    expect((await c.pull(tokens)).phone).toBe("5145559999");
    expect(before.phone).not.toBe("5145559999");
    expect(await c.status(tokens)).toMatchObject({ ok: true });
    await c.revoke(tokens);
    await expect(c.pull(tokens)).rejects.toMatchObject({ kind: "auth" });
  });
  it("builds the authorization address with the signed state it is given", () => {
    const url = new URL(new FakeConnector("facebook").authorizeUrl({ state: "S", redirectUri: "https://x.test/cb" }));
    expect(url.searchParams.get("state")).toBe("S");
  });
});

describe("what a platform tells us is not trusted", () => {
  it("keeps only an http(s) website, a plausible e-mail, and text that fits the storefront", () => {
    const s = sanitizeProfile({ website: "javascript:alert(1)", email: "not an email", description: `  ${"x".repeat(900)}  `, phone: " 514 " });
    expect(s).toMatchObject({ website: "", email: "", phone: "514" });
    expect(s.description).toHaveLength(600);
    expect(sanitizeProfile({ website: "https://ok.test/a" }).website).toBe("https://ok.test/a");
  });
});

describe("hostile input stays linear (CodeQL polynomial regex)", () => {
  it("normalizes a very long run of slashes and rejects an oversized e-mail in bounded time", () => {
    const t0 = Date.now();
    expect(normalizeWebsite(`a${"/".repeat(200_000)}x${"/".repeat(200_000)}`)).toBe(`a${"/".repeat(200_000)}x`);
    expect(sanitizeProfile({ email: `${"!@".repeat(100_000)}.` }).email).toBe("");
    expect(sanitizeProfile({ email: " a@b.co " }).email).toBe("a@b.co");
    // @fixed: generous wall-clock bound; the quadratic version takes tens of seconds on this input.
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
