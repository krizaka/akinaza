import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { readEnv } from "./env";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("the founder offer on the public page", () => {
  it("is hidden until it is switched on", () => {
    expect(readEnv({}).APP_FOUNDER_OFFER_ENABLED).toBe(false);
    expect(readEnv({ APP_FOUNDER_OFFER_ENABLED: "true" }).APP_FOUNDER_OFFER_ENABLED).toBe(true);
    expect(read("app/[locale]/page.tsx")).toMatch(/APP_FOUNDER_OFFER_ENABLED && <FounderOffer/);
  });
  it("says what it is, in both languages: limited, 39 $ a month, setup included", () => {
    for (const t of [en.landing.founder, fr.landing.founder]) {
      const text = JSON.stringify(t);
      expect(text).toContain("39 $");
      expect(t.points.length).toBe(4);
    }
    expect(en.landing.founder.title).toMatch(/setup included/i);
    expect(fr.landing.founder.title).toMatch(/mise en route incluse/i);
    expect(JSON.stringify(en.landing.founder)).toMatch(/limited/i);
    expect(JSON.stringify(fr.landing.founder)).toMatch(/limitée/i);
  });
  it("shows the same amount as the processor's data (the setup script)", () => {
    expect(read("../../scripts/payments-setup.mjs")).toMatch(/akinaza_founder_monthly_cad.*amount: 3900/);
  });
});
