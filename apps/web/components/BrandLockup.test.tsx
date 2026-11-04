import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BrandLockup } from "@/components/BrandLockup";
import { PRODUCT_NAME } from "@/lib/brand";
import { codeNameLine } from "@/lib/code-name";

describe("BrandLockup", () => {
  it("says the commercial name and the endorsement in the page's language", () => {
    expect(renderToStaticMarkup(<BrandLockup locale="fr" />)).toContain(`${PRODUCT_NAME}</span><span class="text-xs text-fg-secondary">par Krizaka`);
    expect(renderToStaticMarkup(<BrandLockup locale="en" />)).toContain("by Krizaka");
  });

  it("is the only lockup: the library's ProductLockup carries every product's mark into the shop pages' JavaScript budget", () => {
    for (const file of ["components/SiteHeader.tsx", "components/account/AccountAuthPage.tsx", "app/[locale]/(app)/sign-in/page.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toContain("ProductLockup");
    }
  });
});

describe("BrandLockup, the code name line (dev only)", () => {
  it("says the code name under the commercial name in the page's language on a dev deployment", async () => {
    vi.stubEnv("APP_ENVIRONMENT", "dev");
    expect(renderToStaticMarkup(<BrandLockup locale="en" />)).toContain('data-code-name="">code name: akinaza</span>');
    expect(renderToStaticMarkup(<BrandLockup locale="fr" />)).toContain('data-code-name="">nom de code : akinaza</span>');
    vi.unstubAllEnvs();
  });

  it("never shows it on production", () => {
    expect(codeNameLine("en", "prod")).toBeNull();
    expect(codeNameLine("fr", "prod")).toBeNull();
    vi.stubEnv("APP_ENVIRONMENT", "prod");
    expect(renderToStaticMarkup(<BrandLockup locale="fr" />)).not.toContain("data-code-name");
    vi.unstubAllEnvs();
  });
});
