import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { retiredAddresses } from "../next.config.mjs";

/** Next's own matcher, the one that reads `source` and fills `destination` (it ships compiled without types). */
const { match, compile } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
  match: (source: string) => (path: string) => { params: unknown } | false;
  compile: (destination: string) => (params: Record<string, string>) => string;
};

const ROOT = join(__dirname, "..");
const APP = join(ROOT, "app");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const SHOP = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const SERVICE = "11111111-2222-4333-8444-555555555555";

interface Rule { source: string; destination: string; permanent: boolean; has?: { type: string; key: string; value: string }[] }
const RULES = retiredAddresses as Rule[];

/** The page file an address opens, by Next's own rules: static segments first, `[param]` after, `(group)` folders transparent. */
function pageFile(segments: string[], dir = APP): string | null {
  if (segments.length === 0) {
    if (existsSync(join(dir, "page.tsx"))) return join(dir, "page.tsx");
    for (const group of readdirSync(dir).filter((d) => /^\(.+\)$/.test(d))) {
      const found = pageFile([], join(dir, group));
      if (found) return found;
    }
    return null;
  }
  const [head, ...rest] = segments;
  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const e of entries.filter((x) => x.name === head)) { const f = pageFile(rest, join(dir, e.name)); if (f) return f; }
  for (const e of entries.filter((x) => /^\[[^.\]]+\]$/.test(x.name))) { const f = pageFile(rest, join(dir, e.name)); if (f) return f; }
  for (const e of entries.filter((x) => /^\(.+\)$/.test(x.name))) { const f = pageFile(segments, join(dir, e.name)); if (f) return f; }
  return null;
}
const opens = (path: string) => pageFile(path.split("/").filter(Boolean));

/** What the configuration does to an address (the first rule that matches, as Next does). */
function redirectOf(path: string, query: Record<string, string> = {}): { to: string; permanent: boolean } | null {
  for (const rule of RULES) {
    const m = match(rule.source)(path);
    if (!m) continue;
    const params: Record<string, string> = { ...(m.params as Record<string, string>) };
    let ok = true;
    for (const has of rule.has ?? []) {
      const found = new RegExp(`^${has.value}$`).exec(query[has.key] ?? "");
      if (!found) ok = false;
      else Object.assign(params, found.groups ?? {});
    }
    if (ok) return { to: compile(rule.destination)(params), permanent: rule.permanent };
  }
  return null;
}

describe("every retired address answers 308 to a page that exists (akinaza#381)", () => {
  const OLD: [string, Record<string, string>, string][] = [
    [`/fr/app/${SHOP}/shop`, {}, `/fr/app/${SHOP}/boutique/page`],
    [`/en/app/${SHOP}/shop/languages`, {}, `/en/app/${SHOP}/boutique/languages`],
    [`/fr/app/${SHOP}/team`, {}, `/fr/app/${SHOP}/boutique/team`],
    ["/fr/s/cedre-ciseaux/book", { service: SERVICE, start: "2026-10-20T13:00:00.000Z" }, `/fr/s/cedre-ciseaux/service/${SERVICE}/confirm`],
    ["/en/s/cedre-ciseaux/book", {}, "/en/s/cedre-ciseaux"],
    ["/en/s/cedre-ciseaux/book", { service: "not-an-id" }, "/en/s/cedre-ciseaux"],
    [`/fr/s/cedre-ciseaux/service/${SERVICE}/creneau`, {}, `/fr/s/cedre-ciseaux/service/${SERVICE}/slots`],
    ["/fr/app/connections", {}, "/fr/app"],
    ["/en/changelog", {}, "/en"],
  ];
  it.each(OLD)("%s", (path, query, to) => {
    const r = redirectOf(path, query);
    expect(r, path).toEqual({ to, permanent: true });
    expect(opens(r!.to), `${r!.to} must be a page`).not.toBeNull();
  });

  it("does not take a path that is not a shop for a shop", () => {
    expect(redirectOf("/fr/app/not-a-shop/shop")).toBeNull();
    expect(redirectOf("/fr/app/shop")).toBeNull();
  });
});

describe("the eight pages that only redirected are gone", () => {
  const GONE = ["books", "clients", "invoices", "shop", "team"].map((s) => `app/[locale]/(app)/app/(legacy)/${s}/page.tsx`).concat(["shop", "shop/languages", "team"].map((s) => `app/[locale]/(app)/app/[shop]/${s}/page.tsx`));
  it.each(GONE)("%s", (file) => expect(existsSync(join(ROOT, file))).toBe(false));

  it("the five that need the shop last worked in are route handlers with a 307, justified in a comment", () => {
    for (const s of ["books", "clients", "invoices", "shop", "team"]) {
      const file = `app/[locale]/(app)/app/(legacy)/${s}/route.ts`;
      expect(existsSync(join(ROOT, file)), file).toBe(true);
      expect(read(file)).toContain("307");
    }
    const handler = read("lib/legacy-redirect.ts");
    expect(handler).toContain("status: 307");
    expect(handler).toMatch(/never keep it|must never keep/);
  });
});

describe("one booking path (akinaza#381)", () => {
  it("the signed-in booking page is gone; the last step of the public path asks for the sign-in", () => {
    expect(existsSync(join(ROOT, "app/[locale]/(app)/s/[slug]/book/page.tsx"))).toBe(false);
    const confirm = read("app/[locale]/s/[slug]/service/[id]/confirm/page.tsx");
    expect(confirm).toContain("sign-in?next=");
    expect(confirm).toContain("/service/${id}/confirm");
  });

  it("no link leads to /book any more", () => {
    for (const file of ["lib/journey.ts", "lib/journey-paths.ts", "components/app/ClientHome.tsx"]) expect(read(file), file).not.toMatch(/\/book[`"?]/);
  });
});

describe("a link that leads nowhere answers 404, not a page that looks alive (akinaza#381)", () => {
  it.each(["invoice", "report", "brief/stop"])("/%s/[token] calls notFound for an unknown or expired token", (route) => {
    const page = read(`app/[locale]/${route}/[token]/page.tsx`);
    expect(page).toContain("notFound()");
    expect(page).toContain('robots: { index: false, follow: false }');
  });
});
