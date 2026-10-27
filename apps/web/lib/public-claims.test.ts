import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { llmsText } from "./seo";

/**
 * akinaza#362. A public text names a place (Canada, Toronto) only when the configured region of the store it describes
 * says so, and never promises conformity to a law: a feature is named by what it does (the consent is noted by purpose),
 * never by the law it answers. The points that need a lawyer are on the lawyer-review list, not in the copy.
 */

const SPEC = new URL("../../../deploy/digitalocean/app.yaml", import.meta.url);

/** The stores a message can describe. Only the database is ever claimed: the media store is elsewhere (see below). */
type Store = "database" | "media";

/** Region slugs of the hosts in use (DigitalOcean, Bunny) and the country of each. An unlisted region never holds. */
const COUNTRY: Record<string, string> = { tor: "CA", tor1: "CA", ny: "US", nyc: "US", nyc1: "US" };
const countryOf = (region: string | null | undefined): string | undefined => (region ? COUNTRY[region] : undefined);

interface Environment {
  name: string;
  /** The region of the app, from the spec's `region:`. */
  app: string;
  /** The region of the managed database cluster the spec names (`krizaka-dev-pg (tor1…)`, krizaka-infra docs/PLAN.md). */
  database: string;
  /** The region of the media store (Bunny storage endpoint), or null when none is configured. */
  media: string | null;
}

function environmentOf(name: string, spec: string): Environment {
  const app = /^region:\s*(\S+)/m.exec(spec)?.[1];
  const database = /krizaka-dev-pg \((\w+)/.exec(spec)?.[1];
  if (!app || !database) throw new Error(`${name}: the spec names no app region or no database region`);
  const endpoint = /key: MEDIA_STORAGE_ENDPOINT[^]*?value: (\S+)/.exec(spec)?.[1];
  return { name, app, database, media: endpoint ? endpoint.split(".")[0]! : null };
}

/** Whether a message about a store holds in an environment: that store's configured region must be in Canada. */
function holds(store: Store, env: Environment): boolean {
  const region = store === "database" ? env.database : env.media;
  return region === null || countryOf(region) === "CA";
}

/** Every public message that names a place as a fact about where data lives, by path, and the store it describes. */
const RESIDENCY_CLAIMS: Record<string, Store> = {
  "landing.trust.line": "database",
  "privacy.body": "database",
  "terms.sections.6.p": "database",
  "docs.pages.data.sections.2.p.0": "database",
};

/** Messages that name a place without a storage claim. */
const NOT_RESIDENCY: Record<string, string> = {
  "privacy.officer.text": "the company's postal address (Montréal, Québec, Canada), published for the person in charge",
  "terms.sections.2.p": "names the Canada Revenue Agency, a tax authority, not a storage place",
  "terms.sections.11.p": "the federal laws of Canada that govern the terms, not a storage place",
  "docs.pages.books.sections.2.p.0": "names the Canada Revenue Agency, a tax authority, not a storage place",
};

function leaves(node: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof node === "string") return [[path.join("."), node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, [...path, String(i)]));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]));
  return [];
}

const PLACE = /\bCanad|Toronto/i;
const placePaths = (dict: unknown) => leaves(dict).filter(([, text]) => PLACE.test(text)).map(([path]) => path);

/** A law or a conformity named as a promise. « Loi 25 » in a feature name or a tagline is the same promise. */
const LEGAL_PROMISE = /\bloi\s*(25|96)\b|\blaw\s*(25|96)\b|\bbill\s*(64|96)\b|dès la conception|by design|\bconform|\bcompliant|\bcompliance\b|\bconçu pour la loi\b/i;

const spec = readFileSync(SPEC, "utf8");
const DEV = environmentOf("dev", spec);

describe("a public place claim follows the configured region (akinaza#362)", () => {
  it("reads the deployed environment: the app and the database in Toronto, the media in New York", () => {
    expect(DEV).toEqual({ name: "dev", app: "tor", database: "tor1", media: "ny" });
  });

  it("maps every configured region to a country (an unknown region is refused, never guessed)", () => {
    expect(countryOf(DEV.app)).toBeDefined();
    expect(countryOf(DEV.database)).toBeDefined();
    expect(countryOf(DEV.media)).toBeDefined();
  });

  it("names every place claim in en and fr, and nothing stale", () => {
    const found = [...new Set([...placePaths(en), ...placePaths(fr)])].sort();
    expect(found).toEqual([...Object.keys(RESIDENCY_CLAIMS), ...Object.keys(NOT_RESIDENCY)].sort());
  });

  it("holds every database claim: the database cluster is in Canada", () => {
    for (const path of Object.keys(RESIDENCY_CLAIMS)) expect(holds(RESIDENCY_CLAIMS[path]!, DEV), path).toBe(true);
  });

  it("claims nothing about the media store: it is in New York, so « photos kept in Canada » would be false", () => {
    expect(Object.values(RESIDENCY_CLAIMS)).not.toContain("media");
    expect(holds("media", DEV)).toBe(false);
  });

  it("refuses a claim whose store is outside Canada (the rule itself)", () => {
    expect(holds("database", { name: "fixture", app: "tor", database: "nyc1", media: null })).toBe(false);
    expect(holds("database", { name: "fixture", app: "tor", database: "unknown", media: null })).toBe(false);
    expect(holds("media", { name: "fixture", app: "tor", database: "tor1", media: null })).toBe(true);
  });
});

describe("the notice describes only the flows the code has (akinaza#364)", () => {
  it("does not say the tax ledger is sent to another service: the figures are computed inside Akinaza", () => {
    for (const m of [en, fr]) expect(m.privacy.body).not.toMatch(/orazaka|envoy|sent to/i);
  });

  it("does not say « shared » when providers receive data, and does not say « sold » of anything but the negation", () => {
    expect(en.privacy.body).not.toMatch(/shared/i);
    expect(fr.privacy.body).not.toMatch(/partag/i);
  });

  it("says the client's information is in a database in Canada, never « processed in Canada » (the media store is in New York)", () => {
    expect(en.terms.sections[6]!.p).not.toMatch(/behalf, in Canada/);
    expect(fr.terms.sections[6]!.p).not.toMatch(/votre compte, au Canada/);
    expect(en.docs.pages.data.sections[2]!.p[0]).not.toMatch(/Data is kept in Canada/);
  });
});

describe("no public text promises conformity to a law (akinaza#362)", () => {
  it("refuses the promise in every message, en and fr", () => {
    const hits = [...leaves(en), ...leaves(fr)].filter(([, text]) => LEGAL_PROMISE.test(text)).map(([path]) => path);
    expect(hits).toEqual([]);
  });

  it("refuses it in llms.txt, the social card and the README", () => {
    const surfaces: Record<string, string> = {
      "llms.txt": llmsText(),
      "og.png": readFileSync(new URL("../app/og.png/route.tsx", import.meta.url), "utf8"),
      README: readFileSync(new URL("../../../README.md", import.meta.url), "utf8"),
    };
    for (const [name, text] of Object.entries(surfaces)) expect(text, name).not.toMatch(LEGAL_PROMISE);
  });

  it("refuses a place claim outside the declared ones in llms.txt, the social card and the README", () => {
    for (const text of [llmsText(), readFileSync(new URL("../app/og.png/route.tsx", import.meta.url), "utf8"), readFileSync(new URL("../../../README.md", import.meta.url), "utf8")]) {
      expect(text).not.toMatch(/data in canada|données au canada/i);
    }
  });

  it("matches what it must catch (the rule itself)", () => {
    for (const bad of ["Loi 25 by design", "Conçu pour la Loi 25", "Données conformes", "Law 25 compliant", "Loi 25 dès la conception"]) expect(LEGAL_PROMISE.test(bad), bad).toBe(true);
    for (const good of ["Consent is noted by purpose", "Le consentement est noté par finalité", "Taxes prepared, return filed by you"]) expect(LEGAL_PROMISE.test(good), good).toBe(false);
  });
});
