import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandLockup } from "@/components/BrandLockup";
import { PRODUCT_NAME } from "@/lib/brand";

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
