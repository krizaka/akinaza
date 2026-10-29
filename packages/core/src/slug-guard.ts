import safeRegex from "safe-regex2";

/**
 * Anti-phishing slugs (ADR-005 slice 4, akinaza#537). A shop address is `<slug>.akinaza.shop`: one that wears a protected brand or a lure word
 * (`login`, `verify`…) is HELD for review (the shop keeps its default address), never silently refused. The list is a setting the console edits.
 */

/** The look-alike digits a phisher swaps for letters. */
const LOOKALIKES: Record<string, string> = { "0": "o", "1": "l", "3": "e", "5": "s" };
const MAX_PATTERN = 100;

/** `l0gin` → `login`: lowercase, the look-alike digits turned into the letters they imitate. */
export function foldLookalikes(slug: string): string {
  return slug.toLowerCase().replace(/[0135]/g, (digit) => LOOKALIKES[digit] ?? digit);
}

export interface ProtectedTerm {
  /** The folded word, or the text of the pattern. */
  source: string;
  /** A `/pattern/` line is tested on the whole folded slug (and on its hyphens-removed form); a word is looked for inside. */
  pattern?: RegExp;
}

const PATTERN_LINE = /^\/(.+)\/$/;
/** A word a slug can contain (letters, digits, hyphens): anything else could never match. */
const REPEATED_ALTERNATION = /\([^()]*\|[^()]*\)[*+{]/;
const WORD = /^[a-z0-9-]+$/i;

export type TermIssueReason = "invalid" | "unsafe" | "too-long" | "word";
export interface TermIssue {
  line: number;
  text: string;
  reason: TermIssueReason;
}

/**
 * Why a `/pattern/` cannot be kept: too long, not a regex, or able to backtrack catastrophically (ReDoS: nested repetition, `(a+)+`).
 * The list is read on the request path, so an unsafe pattern is refused at save and never compiled when read.
 * Trusted OSS behind this function (safe-regex2, fastify, MIT: star height and repetition count); callers never import it.
 */
function patternIssue(source: string): TermIssueReason | undefined {
  if (source.length > MAX_PATTERN) return "too-long";
  try {
    new RegExp(source);
  } catch {
    return "invalid";
  }
  // safe-regex2 sees nested repetition; it misses a repeated alternation of overlapping branches (`(a|aa)+$`), so a repeated group holding `|` is refused as well (conservative: write the alternatives as separate lines).
  return safeRegex(source) && !REPEATED_ALTERNATION.test(source) ? undefined : "unsafe";
}

/** The console's save check: every line of the setting that cannot be kept, with its line number (empty = the text can be saved). */
export function protectedTermsIssues(text: string): TermIssue[] {
  const issues: TermIssue[] = [];
  text.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const source = PATTERN_LINE.exec(line)?.[1];
    const reason = source === undefined ? (WORD.test(line) ? undefined : "word") : patternIssue(source);
    if (reason) issues.push({ line: index + 1, text: line, reason });
  });
  return issues;
}

/** The setting is text, one term per line: a word, or `/regex/`; blank lines and `# comments` are skipped. A bad or unsafe pattern is reported, never fatal, never compiled. */
export function parseProtectedTerms(text: string): { terms: ProtectedTerm[]; invalid: string[] } {
  const terms: ProtectedTerm[] = [];
  const invalid: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const source = PATTERN_LINE.exec(line)?.[1];
    if (source === undefined) {
      terms.push({ source: foldLookalikes(line).replace(/-/g, "") });
    } else if (patternIssue(source)) {
      invalid.push(line);
    } else {
      terms.push({ source, pattern: new RegExp(source) });
    }
  }
  return { terms, invalid };
}

export type SlugVerdict = { held: false } | { held: true; matched: string };

/** Held when the folded slug (as written, or with its hyphens removed: `pay-pal`) contains a listed word or matches a listed pattern. */
export function holdSlug(slug: string, terms: readonly ProtectedTerm[]): SlugVerdict {
  const folded = foldLookalikes(slug);
  const compact = folded.replace(/-/g, "");
  for (const term of terms) {
    const hit = term.pattern ? term.pattern.test(folded) || term.pattern.test(compact) : compact.includes(term.source);
    if (hit) return { held: true, matched: term.source };
  }
  return { held: false };
}
