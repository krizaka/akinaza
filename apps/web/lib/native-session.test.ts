import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
// Two sessions the store knows: an app's bearer and a different account's browser cookie.
vi.mock("./session", async (orig) => ({
  ...(await orig<typeof import("./session")>()),
  resolveSession: async (token?: string) => (token === "bearer-token" ? { account: { id: "app-account" } } : token === "cookie-token" ? { account: { id: "web-account" } } : null),
}));

import { agendaScope, optionalSession, requireSession } from "./access";

const request = (headers: Record<string, string>) => new Request("https://www.akinaza.com/api/me", { headers });

describe("a native app's session", () => {
  it("is read from the bearer alone, by the optional and the required reads alike", async () => {
    const bearerOnly = request({ authorization: "Bearer bearer-token" });
    expect((await optionalSession(bearerOnly))?.account.id).toBe("app-account");
    expect((await requireSession(bearerOnly)).account.id).toBe("app-account");
  });

  it("wins over a different account's cookie, so every route sees the same person", async () => {
    const both = request({ authorization: "Bearer bearer-token", cookie: "akinaza_session=cookie-token" });
    expect((await optionalSession(both))?.account.id).toBe("app-account");
    expect((await requireSession(both)).account.id).toBe("app-account");
    expect((await optionalSession(request({ cookie: "akinaza_session=cookie-token" })))?.account.id).toBe("web-account");
    expect(await optionalSession(request({}))).toBeNull();
  });
});

describe("the agenda a member reads", () => {
  it("is the shop's for whoever handles bookings, a staff member's own otherwise (from the role table)", () => {
    expect(agendaScope("owner", "a1")).toEqual({});
    expect(agendaScope("manager", "a2")).toEqual({});
    expect(agendaScope("staff", "a3")).toEqual({ staffAccountId: "a3" });
  });
});
