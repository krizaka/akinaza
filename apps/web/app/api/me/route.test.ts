import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { accounts } from "@/app/accounts";
import { resolveSession } from "@/lib/session";

import { GET } from "./route";

vi.mock("@/lib/session", async (original) => ({ ...(await original<typeof import("@/lib/session")>()), resolveSession: vi.fn() }));
vi.mock("@/app/accounts", () => ({ accounts: vi.fn() }));

const TOKEN = `as1.${"A".repeat(43)}`;
const ask = (cookie?: string) => GET(new Request("http://localhost/api/me", { headers: cookie ? { cookie } : {} }));

describe("GET /api/me, the public bar's hint", () => {
  beforeEach(() => {
    vi.mocked(accounts).mockReturnValue({ profile: vi.fn(async () => ({ name: "Camille", email: "camille@example.com", avatarSeed: "s3" })) } as never);
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("signed out (no cookie): 200 signedIn false, nothing about anyone, never cached", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);
    const res = await ask();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ signedIn: false, signupOpen: false });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("an expired or revoked session is signed out too", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);
    const res = await ask(`akinaza_session=${TOKEN}`);
    expect(resolveSession).toHaveBeenCalledWith(TOKEN);
    expect((await res.json()).signedIn).toBe(false);
  });

  it("signed in: the name, e-mail and avatar seed for the bar - and only those", async () => {
    vi.mocked(resolveSession).mockResolvedValue({ id: "sess", account: { id: "a1", email: "camille@example.com", role: "USER", locale: "fr" } });
    const body = await (await ask(`akinaza_session=${TOKEN}`)).json();
    expect(body).toEqual({ signedIn: true, signupOpen: false, account: { name: "Camille", email: "camille@example.com", avatarSeed: "s3" } });
  });

  it("tells whether sign-up is open from the deployment's own flag, never a constant", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "true");
    expect((await (await ask()).json()).signupOpen).toBe(true);
  });
});
