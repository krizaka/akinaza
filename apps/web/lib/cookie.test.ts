import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

const load = async (env: Record<string, string>) => {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  return import("./cookie");
};

/** ADR-005 slice 1 (akinaza#534): every cookie of the app is host-locked, and one function makes them. */
describe("the cookie factory", () => {
  it("names a cookie with __Host- in production on an https (or undeclared) origin", async () => {
    expect((await load({ NODE_ENV: "production", APP_PUBLIC_URL: "https://www.akinaza.com" })).cookieName("akinaza_session")).toBe("__Host-akinaza_session");
    expect((await load({ NODE_ENV: "production", APP_PUBLIC_URL: "" })).cookieName("NEXT_LOCALE")).toBe("__Host-NEXT_LOCALE");
  });
  it("keeps the plain names on a plain-http origin (CI, local) and outside production", async () => {
    expect((await load({ NODE_ENV: "production", APP_PUBLIC_URL: "http://localhost:3000" })).cookieName("akinaza_session")).toBe("akinaza_session");
    expect((await load({ NODE_ENV: "development", APP_PUBLIC_URL: "https://www.akinaza.com" })).cookieName("akinaza_session")).toBe("akinaza_session");
  });
  it("sets Secure, Path=/, HttpOnly, SameSite=Lax and never a Domain", async () => {
    const { cookieName, ownCookie } = await load({ NODE_ENV: "production", APP_PUBLIC_URL: "https://www.akinaza.com" });
    const c = ownCookie(cookieName("akinaza_session"), "v", { maxAge: 60 });
    expect(c).toEqual({ name: "__Host-akinaza_session", value: "v", path: "/", secure: true, httpOnly: true, sameSite: "lax", maxAge: 60 });
    expect("domain" in c).toBe(false);
  });
  it("expires a cookie with the same attributes (a __Host- cookie without Secure would be refused)", async () => {
    const { cookieName, expiredCookie } = await load({ NODE_ENV: "production", APP_PUBLIC_URL: "https://www.akinaza.com" });
    expect(expiredCookie(cookieName("akinaza_session"))).toMatchObject({ name: "__Host-akinaza_session", value: "", path: "/", secure: true, maxAge: 0 });
  });
});
