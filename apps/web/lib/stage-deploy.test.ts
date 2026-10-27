import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readEnv } from "./env";

const dir = join(__dirname, "../../../deploy/digitalocean");
const spec = readFileSync(join(dir, "app.yaml"), "utf8");

describe("the stage of the deployment (akinaza#440)", () => {
  it("is dev by default and prod only when said, nothing else", () => {
    expect(readEnv({}).APP_ENVIRONMENT).toBe("dev");
    expect(readEnv({ APP_ENVIRONMENT: "prod" }).APP_ENVIRONMENT).toBe("prod");
    expect(() => readEnv({ APP_ENVIRONMENT: "staging" })).toThrow();
  });

  it("the dev app spec sets the stage to dev, at build too (the pages are static)", () => {
    const block = spec.match(/- key: APP_ENVIRONMENT\n((?:\s+.*\n)+?)\s*(?:#|- key)/);
    expect(block, "APP_ENVIRONMENT is declared").not.toBeNull();
    expect(block![1]).toMatch(/scope: RUN_AND_BUILD_TIME/);
    expect(block![1]).toMatch(/value: "dev"/);
  });

  it("no production spec exists yet: the day one does, it must say prod, which hides the notice", () => {
    expect(readdirSync(dir).filter((f) => f.startsWith("prod"))).toEqual([]);
  });
});
