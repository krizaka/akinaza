// Drift guard (krizaka/.github#356): the demo cast of `@krizaka/org` is the only source of the personas' names. No source file
// spells a persona or shows a « qa » / « admin » account as a display name; the seed and the QA accounts take their names there.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { castOf } from "@krizaka/org";
import { describe, expect, it } from "vitest";

import { accountsFromEnv, QA_PERSONAS } from "../scripts/qa-accounts.mjs";
import { ADMIN, castAccounts, ERIC, LOCAL_SECRET } from "../scripts/seed-cast.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
// Sources only: tests may use a name as a fixture, and the old UX review is prose.
const files = execFileSync("git", ["ls-files", "*.ts", "*.tsx", "*.mjs", "*.json", "*.sh"], { encoding: "utf8", cwd: root })
  .split("\n")
  .filter((f) => f && !/\.test\.|\/test\/|\/__tests__\/|pnpm-lock|messages\/|dev-preview\.json|^docs\//.test(f));
const text = (f: string) => readFileSync(`${root}/${f}`, "utf8");

describe("the cast is the only source of the personas", () => {
  it("spells no persona's name outside the cast", () => {
    const names = castOf("akinaza").map((p) => p.displayName);
    expect(files.filter((f) => names.some((n) => text(f).includes(n)))).toEqual([]);
  });

  it("never shows a qa or admin account as a display name", () => {
    expect(files.filter((f) => /name:\s*["'`](qa[ _-]?(user|admin)|admin|administrator)["'`]/i.test(text(f)))).toEqual([]);
  });

  it("names the QA accounts and the seeded accounts after their personas", () => {
    expect(QA_PERSONAS.USER).toEqual(ERIC);
    expect(QA_PERSONAS.ADMIN).toEqual(ADMIN);
    const env = { QA_USER_EMAIL: "a@x.test", QA_USER_PASSWORD: "x".repeat(14), QA_ADMIN_EMAIL: "b@x.test", QA_ADMIN_PASSWORD: "y".repeat(14) };
    expect(accountsFromEnv(env).map((a: { name: string }) => a.name)).toEqual([ERIC.displayName, ADMIN.displayName]);
  });

  it("gives the cast accounts: the walker, five clients, Éric, the administrator; a default secret only on this machine", () => {
    const local = castAccounts({ DATABASE_URL: "postgres://u@localhost:5432/x" });
    expect(local.map((a: { persona: { id: string } }) => a.persona.id)).toEqual(["lea", "camille", "jordan", "nadia", "etienne", "sofia", "eric", "mira"]);
    expect(local.every((a: { secret: string }) => a.secret === LOCAL_SECRET)).toBe(true);
    expect(() => castAccounts({ DATABASE_URL: "postgres://u@db.example.com/x" })).toThrow(/QA_WALKER_PASSWORD/);
    const remote = castAccounts({ DATABASE_URL: "postgres://u@db.example.com/x", QA_WALKER_PASSWORD: "w".repeat(14), QA_CLIENTS_PASSWORD: "c".repeat(14), QA_ADMIN_PASSWORD: "a".repeat(14), QA_USER_PASSWORD: "u".repeat(14), QA_ADMIN_EMAIL: "Boss@x.test" });
    expect(remote.at(-1)).toMatchObject({ email: "boss@x.test", role: "ADMIN" });
  });
});
