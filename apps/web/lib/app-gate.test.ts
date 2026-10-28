import { describe, expect, it, vi } from "vitest";

import MemberLayout from "@/app/[locale]/(app)/app/layout";
import { POST as signOut } from "@/app/api/auth/sign-out/route";
import { GET as profile } from "@/app/api/me/profile/route";
import { pageSession } from "@/lib/access";
import { revokeSession } from "@/lib/session";

const jar = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
const asked = vi.hoisted(() => ({ path: null as string | null }));
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers(asked.path ? { "x-akinaza-path": asked.path } : {}) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("@/lib/access", async (original) => ({ ...(await original<typeof import("@/lib/access")>()), pageSession: vi.fn() }));
vi.mock("@/lib/session", async (original) => ({ ...(await original<typeof import("@/lib/session")>()), revokeSession: vi.fn() }));

/** The gate behind the bar (krizaka/akinaza#255): the bar is a hint, the app and the API check the real session. */
describe("signed out, the app is closed", () => {
  it.each(["en", "fr"])("a visitor of /%s/app/** is sent to sign-in", async (locale) => {
    vi.mocked(pageSession).mockResolvedValue(null);
    await expect(MemberLayout({ children: null, params: Promise.resolve({ locale }) })).rejects.toThrow(`REDIRECT /${locale}/sign-in`);
  });

  it("a deep link keeps its destination through sign-in (#287)", async () => {
    vi.mocked(pageSession).mockResolvedValue(null);
    asked.path = "/fr/app/invoices";
    await expect(MemberLayout({ children: null, params: Promise.resolve({ locale: "fr" }) })).rejects.toThrow("REDIRECT /fr/sign-in?next=%2Ffr%2Fapp%2Finvoices");
    asked.path = null;
  });

  it("a signed-in visitor goes through", async () => {
    vi.mocked(pageSession).mockResolvedValue({ id: "s", account: { id: "a", email: "a@example.com", role: "USER", locale: "en" } });
    await expect(MemberLayout({ children: "page", params: Promise.resolve({ locale: "en" }) })).resolves.toBe("page");
  });

  it("the API answers 401 without a session, with a forged cookie too", async () => {
    expect((await profile(new Request("http://localhost/api/me/profile"))).status).toBe(401);
    expect((await profile(new Request("http://localhost/api/me/profile", { headers: { cookie: "akinaza_session=forged" } }))).status).toBe(401);
  });

  it("signing out revokes the session and clears the cookie", async () => {
    jar.get.mockReturnValue({ value: `as1.${"B".repeat(43)}` });
    expect((await signOut(new Request("http://localhost/api/auth/sign-out", { method: "POST" }))).status).toBe(204);
    expect(revokeSession).toHaveBeenCalledWith(`as1.${"B".repeat(43)}`);
    expect(jar.delete).toHaveBeenCalledWith("akinaza_session");
  });
});
