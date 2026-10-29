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

/** The setting is text, one term per line: a word, or `/regex/`; blank lines and `# comments` are skipped. A bad pattern is reported, never fatal. */
export function parseProtectedTerms(text: string): { terms: ProtectedTerm[]; invalid: string[] } {
  const terms: ProtectedTerm[] = [];
  const invalid: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const source = /^\/(.+)\/$/.exec(line)?.[1];
    if (source === undefined) {
      terms.push({ source: foldLookalikes(line).replace(/-/g, "") });
      continue;
    }
    try {
      if (source.length > MAX_PATTERN) throw new Error("too long");
      terms.push({ source, pattern: new RegExp(source) });
    } catch {
      invalid.push(line);
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
