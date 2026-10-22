import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(new URL("../deploy/docker/Dockerfile", import.meta.url), "utf8");

// @ast-grep/cli's postinstall finds no linux-musl binary on node:alpine: the image installs without install scripts.
describe("the image build", () => {
  it("installs without running install scripts", () => {
    expect(dockerfile).toMatch(/(npm ci|pnpm install --frozen-lockfile)[^\n]*--ignore-scripts/);
  });

  it("copies only paths that exist in the repository (a deleted package once broke the deploy: #163)", () => {
    const sources = dockerfile
      .split("\n")
      .filter((line) => /^COPY\s/.test(line) && !/--from=/.test(line))
      .flatMap((line) => line.replace(/^COPY\s+(--\S+\s+)*/, "").trim().split(/\s+/).slice(0, -1));
    expect(sources.length).toBeGreaterThan(0);
    const missing = sources.filter((src) => src !== "." && !existsSync(new URL(`../${src}`, import.meta.url)));
    expect(missing).toEqual([]);
  });
});
