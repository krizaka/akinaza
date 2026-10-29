import { protectedTermsIssues, type TermIssueReason } from "@akinaza/core";

/**
 * The console's view of the `slugs.protectedTerms` setting (one term per line: a word, or `/regex/`; `# comment` and blank lines kept as they are).
 * The administrator adds, edits and removes lines; the text goes back to the setting whole. Pure, so the same checks run under the field as the
 * server's save (`protectedTermsIssues` of @akinaza/core, the schema of the setting).
 */

export type TermKind = "word" | "pattern" | "comment";
export interface TermRow {
  /** Position in the stored text (the identity of a row until the next save). */
  index: number;
  text: string;
  kind: TermKind;
  /** Why the line could not be kept, if it cannot: the stored text is read as it is, so a bad line stored earlier still shows. */
  issue?: TermIssueReason;
}

function kindOf(line: string): TermKind {
  if (line.startsWith("#")) return "comment";
  return line.length > 2 && line.startsWith("/") && line.endsWith("/") ? "pattern" : "word";
}

/** The text of the setting out of `GET /api/admin/settings`, where each value is `{ value, source }` (a plain string is read too). */
export function storedTerms(entry: unknown): string {
  const value = typeof entry === "object" && entry !== null && "value" in entry ? entry.value : entry;
  return typeof value === "string" ? value : "";
}

/** The lines worth listing: blank lines are skipped, comments are listed (and can be removed). */
export function termRows(stored: string): TermRow[] {
  const issues = new Map(protectedTermsIssues(stored).map((i) => [i.line - 1, i.reason]));
  return stored.split("\n").flatMap((raw, index) => {
    const text = raw.trim();
    if (!text) return [];
    const issue = issues.get(index);
    return [{ index, text, kind: kindOf(text), ...(issue ? { issue } : {}) }];
  });
}

/** What the field under the form says while the administrator types: the first reason this single line cannot be saved, or nothing. */
export function lineIssue(line: string): TermIssueReason | undefined {
  const text = line.trim();
  if (!text || text.startsWith("#")) return undefined;
  return protectedTermsIssues(text)[0]?.reason;
}

/** Adds a term at the end; a line that is already there (any case, for words) is not added twice. */
export function addTerm(stored: string, line: string): string {
  const text = line.trim();
  const rows = termRows(stored);
  if (rows.some((r) => r.text.toLowerCase() === text.toLowerCase())) return stored;
  const base = stored.trimEnd();
  return base ? `${base}\n${text}` : text;
}

/** Replaces the line at `index`. */
export function replaceTerm(stored: string, index: number, line: string): string {
  const lines = stored.split("\n");
  lines[index] = line.trim();
  return lines.join("\n");
}

/** Removes the line at `index`. */
export function removeTerm(stored: string, index: number): string {
  return stored.split("\n").filter((_, i) => i !== index).join("\n");
}
