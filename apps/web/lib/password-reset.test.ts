import { describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ rows: [] as unknown[], calls: [] as unknown[][] }));
vi.mock("./db", () => ({ query: async (...args: unknown[]) => (queries.calls.push(args), queries.rows) }));
vi.mock("./audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("./session", () => ({ tokenHash: (token: string) => `hash:${token}` }));

const { AccountError } = await import("@krizaka/auth");
const { audit } = await import("./audit");
const { requestPasswordReset, resetPassword } = await import("./password-reset");

const headers = new Headers();
const now = new Date("2026-10-24T15:00:00Z");

describe("a forgotten password, on @krizaka/auth", () => {
  it("asks the block for the link with the clock it is given, and audits only an account that exists", async () => {
    const resets = { requestPasswordReset: vi.fn(async () => undefined), resetPassword: vi.fn() };
    queries.rows = [];
    await requestPasswordReset(resets, " Lea@Example.test ", now, headers);
    expect(resets.requestPasswordReset).toHaveBeenCalledWith(" Lea@Example.test ", now);
    expect(queries.calls.at(-1)![1]).toEqual(["lea@example.test"]);
    expect(audit).not.toHaveBeenCalled();
    queries.rows = [{ id: "a1", email: "lea@example.test" }];
    await requestPasswordReset(resets, "lea@example.test", now, headers);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.password_reset_requested", actorId: "a1" }));
  });

  it("answers INVALID_TOKEN for a link the block refuses, and the block's own refusal with its code", async () => {
    const invalid = { requestPasswordReset: vi.fn(), resetPassword: vi.fn(async () => "INVALID" as const) };
    await expect(resetPassword(invalid, "ae1.x", "a long enough password", now, headers)).rejects.toMatchObject({ status: 400, body: { code: "INVALID_TOKEN" } });
    const weak = {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(async () => {
        throw new AccountError(400, "PASSWORD_TOO_SHORT", "At least 12 characters");
      }),
    };
    await expect(resetPassword(weak, "ae1.x", "short", now, headers)).rejects.toMatchObject({ status: 400, body: { code: "PASSWORD_TOO_SHORT" } });
  });

  it("audits the account whose password the link changed", async () => {
    queries.rows = [{ id: "a2", email: "marc@example.test" }];
    const ok = { requestPasswordReset: vi.fn(), resetPassword: vi.fn(async () => "CHANGED" as const) };
    await resetPassword(ok, "ae1.token", "a long enough password", now, headers);
    expect(queries.calls.at(-1)![1]).toEqual(["hash:ae1.token"]);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.password_reset", actorId: "a2" }));
  });
});
