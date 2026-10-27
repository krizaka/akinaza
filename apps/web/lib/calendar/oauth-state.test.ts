import { describe, expect, it } from "vitest";

import { newPkce, pkceCookie, signState, STATE_TTL_SECONDS, verifierFor, verifyState } from "./oauth-state";
import { connectable, sealedCaldav, sourceFactory } from "./registry";

const NOW = new Date("2026-10-26T12:00:00Z");
const input = { kind: "google", shopId: "s1", staffId: null, accountId: "a1", label: "Mine", locale: "en" } as const;

describe("the signed state of the OAuth round trip", () => {
  it("comes back whole with what was signed, and carries no secret", () => {
    const { state } = signState(input, "secret-key", NOW);
    expect(verifyState(state, "secret-key", NOW)).toMatchObject(input);
    expect(Buffer.from(state.split(".")[0]!, "base64url").toString()).not.toMatch(/secret-key|verifier/);
  });

  it("is refused when altered, signed with another key, expired, or not a state at all", () => {
    const { state } = signState(input, "secret-key", NOW);
    const [body, sig] = state.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), accountId: "attacker" })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`, "secret-key", NOW)).toBeNull();
    expect(verifyState(state, "other-key", NOW)).toBeNull();
    expect(verifyState(state, "secret-key", new Date(NOW.valueOf() + (STATE_TTL_SECONDS + 1) * 1000))).toBeNull();
    for (const bad of ["", "x", "a.b.c", `${body}.`]) expect(verifyState(bad, "secret-key", NOW)).toBeNull();
  });

  it("refuses a state naming a kind that is not an OAuth provider", () => {
    const { state } = signState({ ...input, kind: "ics" as never }, "k", NOW);
    expect(verifyState(state, "k", NOW)).toBeNull();
  });
});

describe("PKCE", () => {
  it("sends the S256 challenge of a verifier that stays in the browser's cookie, tied to the state's nonce", () => {
    const { verifier, challenge } = newPkce();
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).not.toBe(verifier);
    const cookie = pkceCookie("n1", verifier, true);
    expect(cookie).toMatch(/HttpOnly; SameSite=Lax/);
    expect(cookie).toContain("Secure");
    const header = cookie.split(";")[0]!;
    expect(verifierFor(`a=b; ${header}`, "n1")).toBe(verifier);
    expect(verifierFor(header, "other")).toBeNull();
    expect(verifierFor(null, "n1")).toBeNull();
  });
});

describe("the registry", () => {
  const apps = { google: { clientId: "i", clientSecret: "s" } };
  const make = sourceFactory(apps, { ics: true, google: true, outlook: true, caldav: false });

  it("reads an ICS address always, a provider only when its flag is on and its client exists, CalDAV only with a whole credential", () => {
    expect(make("ics", "https://example.com/a.ics", "UTC")?.kind).toBe("ics");
    expect(make("google", "refresh", "UTC")?.kind).toBe("google");
    expect(make("outlook", "refresh", "UTC")).toBeNull();
    expect(make("caldav", sealedCaldav({ url: "https://x/", username: "u", password: "p" }), "UTC")).toBeNull();
    const on = sourceFactory({}, { caldav: true });
    expect(on("caldav", sealedCaldav({ url: "https://x/", username: "u", password: "p" }), "UTC")?.kind).toBe("caldav");
    expect(on("caldav", "not json", "UTC")).toBeNull();
    expect(on("caldav", JSON.stringify({ url: "https://x/" }), "UTC")).toBeNull();
  });

  it("offers consent only for a configured provider", () => {
    expect(connectable("google", apps)?.kind).toBe("google");
    expect(connectable("outlook", apps)).toBeNull();
  });
});
