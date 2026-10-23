import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

/** The family rule (krizaka-ui#505, 2026-10-23): the app first, never « Talk to us » — contact lives in the footer (krizaka/akinaza#285). */
const SALES_CALL = /talk to us|parlez-nous/i;
const ROOT = join(__dirname, "..");

describe("no « Talk to us » or « Parlez-nous » on a public page", () => {
  it.each([["en", en], ["fr", fr]] as const)("the %s catalogue carries no sales-call wording", (_, messages) => {
    expect(JSON.stringify(messages)).not.toMatch(SALES_CALL);
  });

  it("the llms.txt of the site names no sales call either", () => {
    expect(readFileSync(join(ROOT, "lib/seo.ts"), "utf8")).not.toMatch(SALES_CALL);
  });
});
