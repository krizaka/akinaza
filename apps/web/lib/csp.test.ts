import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import nextConfig from "../next.config.mjs";

/** Loi 25: a page frames a third party only for the three video platforms, and a script, a font or a connection never goes to one (B45, #312). */
describe("the content security policy", async () => {
  const headers = (await nextConfig.headers?.()) as { headers: { key: string; value: string }[] }[];
  const csp = headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")!.value;
  const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `))?.split(" ").slice(1) ?? [];

  it("frames this origin (the studio's preview) and the three embed hosts, nothing else", () => {
    expect(directive("frame-src").sort()).toEqual(["'self'", "https://www.instagram.com", "https://www.tiktok.com", "https://www.youtube-nocookie.com"].sort());
  });
  it("lets no third party run a script, load a font or answer a request", () => {
    for (const name of ["script-src", "font-src", "connect-src", "default-src", "object-src"]) {
      expect(directive(name).filter((source) => source.startsWith("https://") && !source.includes("krizaka-assets")), name).toEqual([]);
    }
  });
  it("still refuses to be framed by anyone but itself", () => {
    expect(directive("frame-ancestors")).toEqual(["'self'"]);
  });
  it("upgrades insecure requests in production unless the declared public origin is plain http", async () => {
    const cspWith = async (env: Record<string, string | undefined>) => {
      const saved = { ...process.env };
      for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      try {
        vi.resetModules();
        const config = (await import("../next.config.mjs")).default;
        const all = (await config.headers?.()) as { headers: { key: string; value: string }[] }[];
        return all.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")!.value;
      } finally {
        for (const k of Object.keys(env)) {
          if (saved[k] === undefined) delete process.env[k];
          else process.env[k] = saved[k];
        }
      }
    };
    expect(await cspWith({ NODE_ENV: "production", APP_PUBLIC_URL: "https://www.akinaza.com" })).toContain("upgrade-insecure-requests");
    expect(await cspWith({ NODE_ENV: "production", APP_PUBLIC_URL: undefined })).toContain("upgrade-insecure-requests");
    expect(await cspWith({ NODE_ENV: "production", APP_PUBLIC_URL: "http://localhost:3000" })).not.toContain("upgrade-insecure-requests");
  });
});

/** The CSP is baked at build: turbo hands the build task only the variables it declares, so the one the policy reads must be declared (#515: the CI build never saw it). */
describe("the build reads what the policy depends on", () => {
  it("turbo declares APP_PUBLIC_URL for the build task", () => {
    const turbo = JSON.parse(readFileSync(new URL("../../../turbo.json", import.meta.url), "utf8")) as { tasks: { build: { env: string[] } } };
    expect(turbo.tasks.build.env).toContain("APP_PUBLIC_URL");
  });
});
