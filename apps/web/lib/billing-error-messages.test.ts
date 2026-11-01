import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

const root = join(__dirname, "..", "app", "api", "billing");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : []));
const codes = [...new Set(files(root).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/refuse\(\d+, "([A-Z_]+)"/g)].map((m) => m[1] as string)))];
const known = (dict: unknown, code: string): boolean => JSON.stringify(dict).includes(`"${code}":`);

describe("billing refusals are worded", () => {
  it("finds the codes", () => expect(codes).toContain("PAYMENTS_OFF"));
  it.each(codes)("%s has an English and a French message", (code) => {
    expect(known(en, code), `${code} missing in en.json`).toBe(true);
    expect(known(fr, code), `${code} missing in fr.json`).toBe(true);
  });
});
