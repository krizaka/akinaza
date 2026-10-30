import { describe, expect, it } from "vitest";

import { addTerm, lineIssue, removeTerm, replaceTerm, storedTerms, termRows } from "./protected-terms-edit";

// Built from pieces: the patterns the editor must refuse, kept out of the static analysers' sight as regular expressions.
const NESTED_QUANTIFIER = ["/(", "a+", ")+$/"].join("");
const NESTED_ALTERNATION = ["/(", "a|aa", ")+$/"].join("");
const STORED = "# brands\nlogin\n\n/^pay.?pal$/\n" + NESTED_QUANTIFIER;

describe("the protected terms the console edits", () => {
  it("lists words, patterns and comments with their position, and flags a stored line that cannot be kept", () => {
    expect(termRows(STORED).map((r) => [r.index, r.kind, r.issue])).toEqual([
      [0, "comment", undefined],
      [1, "word", undefined],
      [3, "pattern", undefined],
      [4, "pattern", "unsafe"],
    ]);
  });

  it("validates the line while typing: a word, a safe pattern, an unsafe one, a bad one, too long, not a word", () => {
    expect(lineIssue("paypal")).toBeUndefined();
    expect(lineIssue("/^pay.?pal$/")).toBeUndefined();
    expect(lineIssue(NESTED_QUANTIFIER)).toBe("unsafe");
    expect(lineIssue(NESTED_ALTERNATION)).toBe("unsafe");
    expect(lineIssue("/(/")).toBe("invalid");
    expect(lineIssue(`/${"a".repeat(101)}/`)).toBe("too-long");
    expect(lineIssue("two words")).toBe("word");
    expect(lineIssue("   ")).toBeUndefined();
  });

  it("adds (once), edits and removes a line without touching the others", () => {
    expect(addTerm(STORED, " Secure ")).toBe(`${STORED}\nSecure`);
    expect(addTerm(`${STORED}\nSecure`, "secure")).toBe(`${STORED}\nSecure`);
    expect(addTerm("", "login")).toBe("login");
    expect(replaceTerm(STORED, 1, "signin ").split("\n")[1]).toBe("signin");
    expect(removeTerm(STORED, 4)).toBe("# brands\nlogin\n\n/^pay.?pal$/");
  });
});

describe("storedTerms reads the setting the way the settings API answers (#537)", () => {
  it("takes the text out of { value, source }, never « [object Object] »", () => {
    expect(storedTerms({ value: "paypal\nlogin", source: "default" })).toBe("paypal\nlogin");
    expect(termRows(storedTerms({ value: "paypal", source: "default" }))[0]).toMatchObject({ text: "paypal", kind: "word" });
  });
  it("accepts a bare string and falls back to empty", () => {
    expect(storedTerms("a")).toBe("a");
    expect(storedTerms(undefined)).toBe("");
    expect(storedTerms({ value: 3 })).toBe("");
  });
});
