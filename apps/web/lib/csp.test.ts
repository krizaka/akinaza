import { describe, expect, it } from "vitest";

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
});
