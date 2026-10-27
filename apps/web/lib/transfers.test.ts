import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

/**
 * akinaza#369. The register of the places that hold personal information (docs/privacy/transfers.json) follows the deployment spec:
 * a store, a region or a configuration context the spec adds and the register does not list fails here, so the assessment of a
 * transfer outside Québec (P-39.1 art. 17) is written before the data goes there.
 */

const ROOT = new URL("../../../", import.meta.url);
const SPEC = readFileSync(new URL("deploy/digitalocean/app.yaml", ROOT), "utf8");
const REGISTER = JSON.parse(readFileSync(new URL("docs/privacy/transfers.json", ROOT), "utf8")) as Register;
const TRANSFERS_MD = readFileSync(new URL("docs/privacy/transfers.md", ROOT), "utf8");
const EFVP_MD = readFileSync(new URL("docs/privacy/efvp.md", ROOT), "utf8");

interface Register {
  contexts: string[];
  contextsNotDeployed: Record<string, string>;
  stores: Array<{ id: string; supplier: string; region: string; country: string; province: string }>;
  processors: Array<{ id: string; name: string; category: string; deployed: boolean; region: string; agreement: string; dpa: string }>;
}

/** What the spec says: the app region, the database region, the media endpoint's region, the environment contexts it sets. */
export function storesOfSpec(spec: string): Record<string, string> {
  const app = /^region:\s*(\S+)/m.exec(spec)?.[1];
  const database = /krizaka-dev-pg \((\w+)/.exec(spec)?.[1];
  const endpoint = /key: MEDIA_STORAGE_ENDPOINT[^]*?value: (\S+)/.exec(spec)?.[1];
  const found: Record<string, string> = {};
  if (app) found.app = app;
  if (database) found.database = database;
  if (endpoint) found.media = endpoint.split(".")[0]!;
  return found;
}

export function contextsOfSpec(spec: string): string[] {
  const keys = [...spec.matchAll(/^\s*- key: ([A-Z0-9_]+)/gm)].map((m) => m[1]!);
  return [...new Set(keys.filter((k) => k.includes("_")).map((k) => `${k.split("_")[0]}_`))].filter((c) => c !== "NODE_").sort();
}

/** What the register fails to cover for a given spec. */
export function gaps(spec: string, register: Pick<Register, "contexts" | "stores">): string[] {
  const out: string[] = [];
  const stores = storesOfSpec(spec);
  for (const [id, region] of Object.entries(stores)) {
    const listed = register.stores.find((s) => s.id === id);
    if (!listed) out.push(`store « ${id} » (${region}) is not in the register`);
    else if (listed.region !== region) out.push(`store « ${id} » is in ${region} in the spec and ${listed.region} in the register`);
  }
  for (const s of register.stores) if (!(s.id in stores)) out.push(`the register lists store « ${s.id} » the spec no longer has`);
  for (const c of contextsOfSpec(spec)) if (!register.contexts.includes(c)) out.push(`the spec sets ${c}* and the register does not list that context`);
  return out;
}

describe("the transfer register follows the deployment spec (akinaza#369)", () => {
  it("covers every store, region and configuration context of the spec", () => {
    expect(gaps(SPEC, REGISTER)).toEqual([]);
  });

  it("proves each region it states: the spec names it", () => {
    expect(storesOfSpec(SPEC)).toEqual({ app: "tor", database: "tor1", media: "ny" });
    expect(REGISTER.stores.map((s) => [s.id, s.country])).toEqual([["app", "CA"], ["database", "CA"], ["media", "US"]]);
  });

  it("stays silent about Québec hosting: nothing is stored in Québec", () => {
    for (const s of REGISTER.stores) expect(s.province).toMatch(/^outside /);
  });

  it("refuses a store the register does not list (the rule itself)", () => {
    const added = `${SPEC}\n      - key: MAIL_PROVIDER\n        value: mailgun\n`;
    expect(gaps(added, REGISTER)).toEqual(["the spec sets MAIL_* and the register does not list that context"]);
    expect(gaps(SPEC.replace("value: ny.storage.bunnycdn.com", "value: storage.bunnycdn.com"), REGISTER)).toEqual(["store « media » is in storage in the spec and ny in the register"]);
    expect(gaps(SPEC.replace("(tor1", "(nyc1"), REGISTER)).toEqual(["store « database » is in nyc1 in the spec and tor1 in the register"]);
  });

  it("keeps a context that is not deployed named, with its reason, for the day it is", () => {
    for (const context of ["MAIL_", "PAYMENTS_", "AI_"]) {
      expect(contextsOfSpec(SPEC)).not.toContain(context);
      expect(REGISTER.contextsNotDeployed[context]).toBeTruthy();
    }
  });

  it("writes « to confirm » for every region it has not proven, and collects every contract", () => {
    for (const p of REGISTER.processors) {
      if (!p.deployed) expect(p.region, p.id).toMatch(/to-confirm/);
      expect(p.agreement, p.id).toMatch(/^(to-collect|internal, to write)$/);
    }
    expect(REGISTER.processors.filter((p) => !p.deployed).map((p) => p.id)).toEqual(["mailgun", "stripe", "orazaka"]);
  });

  it("names every supplier in the readable version, and points the open regions to .github#285", () => {
    for (const p of REGISTER.processors) expect(TRANSFERS_MD, p.id).toContain(p.name);
    expect(TRANSFERS_MD).toContain("krizaka/.github#285");
    expect(TRANSFERS_MD).toContain("Canadian hosting for production is *planned*");
    expect(TRANSFERS_MD).toContain("https://www.legisquebec.gouv.qc.ca/");
  });

  it("cites the law by name and article, never pastes an article's text", () => {
    for (const text of [TRANSFERS_MD, EFVP_MD]) {
      expect(text).toMatch(/art(s?)\. 17|art\. 3\.3/);
      expect(text).not.toMatch(/\b(shall|doit s'assurer|l'entreprise qui souhaite)\b/i);
    }
  });
});

describe("the privacy notice names every category of processor (akinaza#369)", () => {
  it.each([["en", en], ["fr", fr]] as const)("%s: a line per category, none promising a residency", (_lang, m) => {
    const items = m.privacy.processors.items;
    expect(items).toHaveLength(5);
    const text = items.map((i) => `${i.h} ${i.p}`).join(" ");
    expect(text).not.toMatch(/\bCanad/);
    expect(text).toMatch(/New York/);
  });

  it("states the media store's place only where the spec proves it", () => {
    expect(storesOfSpec(SPEC).media).toBe("ny");
  });
});
