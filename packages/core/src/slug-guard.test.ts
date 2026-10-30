import { describe, expect, it } from "vitest";

import { foldLookalikes, holdSlug, parseProtectedTerms, protectedTermsIssues } from "./slug-guard";

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

/**
 * A deliberately catastrophic pattern as a line of the setting, put together at run time: written whole, CodeQL (js/redos) reads the test's
 * strings as patterns of the code and flags them, though nothing here ever runs one (that is what the guard under test refuses).
 */
const pattern = (...parts: string[]): string => `/${parts.join("")}/`;

describe("protectedTermsIssues (the console's save check, #537)", () => {
  it("accepts words, comments and safe patterns", () => {
    expect(protectedTermsIssues("# brands\npaypal\nl0gin\n/^bank(ing)?$/\n/pass-?wo?rd/")).toEqual([]);
  });
  it("refuses a pattern that does not compile, with the line number", () => {
    expect(protectedTermsIssues("login\n/(unclosed/")).toEqual([{ line: 2, text: "/(unclosed/", reason: "invalid" }]);
  });
  it("refuses a pattern that can backtrack catastrophically (ReDoS), and never runs it", () => {
    const [nested, star, alternation] = [pattern("(a", "+)", "+$"), pattern("(x", "*)", "*y"), pattern("(a|", "aa)", "+$")];
    expect(protectedTermsIssues([nested, star, alternation].join("\n"))).toEqual([
      { line: 1, text: nested, reason: "unsafe" },
      { line: 2, text: star, reason: "unsafe" },
      { line: 3, text: alternation, reason: "unsafe" },
    ]);
  });
  it("refuses a pattern longer than 100 characters", () => {
    expect(protectedTermsIssues(`/${"a".repeat(101)}/`)).toEqual([{ line: 1, text: `/${"a".repeat(101)}/`, reason: "too-long" }]);
  });
  it("refuses a word the slug could never contain", () => {
    expect(protectedTermsIssues("pay pal\nok-word\nUPPER")).toEqual([{ line: 1, text: "pay pal", reason: "word" }]);
  });
  it("parseProtectedTerms drops an unsafe pattern too, so a stored one cannot run", () => {
    const nested = pattern("(a", "+)", "+$");
    const { terms, invalid } = parseProtectedTerms(`${nested}\nlogin`);
    expect(terms.map((t) => t.source)).toEqual(["login"]);
    expect(invalid).toEqual([nested]);
  });
});
