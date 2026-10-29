import { describe, expect, it } from "vitest";

import { foldLookalikes, holdSlug, parseProtectedTerms } from "./slug-guard";

const TERMS = parseProtectedTerms(["# brands", "desjardins", "paypal", "", "# lure terms", "login", "verify", "secure", "/^bank(ing)?$/", "/pass-?wo?rd/"].join("\n")).terms;

describe("foldLookalikes (ADR-005 slice 4, #537)", () => {
  it.each([
    ["l0gin", "login"],
    ["paypa1", "paypal"],
    ["s3cur3", "secure"],
    ["5ecure", "secure"],
    ["desjardins-c0nnexion", "desjardins-connexion"],
    ["pattes-saint-henri", "pattes-saint-henri"],
  ])("%s folds to %s", (slug, folded) => {
    expect(foldLookalikes(slug)).toBe(folded);
  });
});

describe("parseProtectedTerms", () => {
  it("reads one term per line, skips blanks and # comments, folds the words, keeps /regex/ lines", () => {
    const { terms, invalid } = parseProtectedTerms("PayPal\n\n# note\n  l0gin  \n/^bank$/\n");
    expect(terms.map((t) => t.source)).toEqual(["paypal", "login", "^bank$"]);
    expect(invalid).toEqual([]);
  });
  it("reports a regex that does not compile or is too long, and keeps the others", () => {
    const { terms, invalid } = parseProtectedTerms(`/(unclosed/\n/${"a".repeat(101)}/\nlogin`);
    expect(terms.map((t) => t.source)).toEqual(["login"]);
    expect(invalid).toHaveLength(2);
  });
});

describe("holdSlug: a slug that wears a protected word is held for review, never refused", () => {
  it.each([
    ["desjardins-connexion", "desjardins"],
    ["d3sjardins", "desjardins"],
    ["pay-pal-aide", "paypal"],
    ["paypa1", "paypal"],
    ["mon-l0gin", "login"],
    ["verify-account", "verify"],
    ["banking", "^bank(ing)?$"],
    ["my-p4ssword", null],
    ["pass-w0rd", "pass-?wo?rd"],
  ])("%s", (slug, matched) => {
    const verdict = holdSlug(slug, TERMS);
    if (matched === null) expect(verdict.held).toBe(false);
    else expect(verdict).toEqual({ held: true, matched });
  });

  it("lets an ordinary shop address through, and an empty list holds nothing", () => {
    expect(holdSlug("pattes-saint-henri", TERMS)).toEqual({ held: false });
    expect(holdSlug("coiffure-marie", TERMS)).toEqual({ held: false });
    expect(holdSlug("desjardins", [])).toEqual({ held: false });
  });
  it("matches across hyphens (pay-pal) but a regex anchored on the whole slug does not match a longer one", () => {
    expect(holdSlug("pay-pal", TERMS).held).toBe(true);
    expect(holdSlug("the-bank-of-me", TERMS).held).toBe(false);
  });
});
