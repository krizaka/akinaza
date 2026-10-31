import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SHOP_TYPES } from "@akinaza/core";

import hashes from "./demo-st-henri.hashes.json";
import { ALL_DEMO_SHOPS, ST_HENRI_DEMO_SHOPS } from "./demo-shops";

/**
 * The Saint-Henri demo set is built from a PRIVATE field survey (krizaka-internal#1660). Nothing of it may be recognisable:
 * no name, no photo, no point within 100 m of a surveyed business. CI knows the survey only through SHA-256 hashes of its
 * normalised names (and of their distinctive words); the position check runs where the private file is present.
 */
const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).join(" ");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const GENERIC = new Set("salon studio boutique friperie shop mtl montreal saint henri st de du la le les des et the and yoga coiffure beaute esthetique spa centre center fitness chien chiens dog dogs vintage atelier demo musique music cours soins massotherapie barbe barbier notre dame marche wear wash pattes".split(" "));

describe("the Saint-Henri demo set", () => {
  it("holds the shops, each with a point, services and hours", () => {
    expect(ST_HENRI_DEMO_SHOPS.length).toBeGreaterThanOrEqual(20);
    for (const d of ST_HENRI_DEMO_SHOPS) {
      expect(SHOP_TYPES as readonly string[], d.shop.slug).toContain(d.shopType);
      expect(d.zone, d.shop.slug).toBeDefined();
      expect(d.services.length, d.shop.slug).toBeGreaterThan(0);
      expect(d.team[0]!.hours.length, d.shop.slug).toBeGreaterThan(0);
      expect(d.cover, "no photo: the trade's defaults draw the page").toBeUndefined();
    }
  });

  it("has unique slugs and owners across every demo shop, and says it is fictional", () => {
    expect(new Set(ALL_DEMO_SHOPS.map((d) => d.shop.slug)).size).toBe(ALL_DEMO_SHOPS.length);
    expect(new Set(ALL_DEMO_SHOPS.map((d) => d.ownerEmail)).size).toBe(ALL_DEMO_SHOPS.length);
    for (const d of ST_HENRI_DEMO_SHOPS) {
      expect(d.profile.bioFr, d.shop.slug).toMatch(/fictif/);
      expect(d.profile.bioEn, d.shop.slug).toMatch(/fictional/);
      expect(d.shop.address, d.shop.slug).toMatch(/rue Fictive/);
      expect(d.profile.publicPhone, d.shop.slug).toMatch(/^514-555-01\d\d$/);
    }
    expect(new Set(ALL_DEMO_SHOPS.map((d) => d.profile.publicPhone)).size).toBe(ALL_DEMO_SHOPS.length);
  });

  it("keeps every point in the neighbourhood", () => {
    for (const d of ST_HENRI_DEMO_SHOPS) {
      expect(Math.abs(d.zone!.lat - 45.4786), d.shop.slug).toBeLessThan(0.025);
      expect(Math.abs(d.zone!.lng - -73.5878), d.shop.slug).toBeLessThan(0.035);
    }
  });

  it("names no surveyed business, nor a distinctive word of one (hashes only)", () => {
    expect(hashes.names.length).toBeGreaterThan(0);
    const names = new Set(hashes.names);
    const words = new Set(hashes.words);
    for (const d of ST_HENRI_DEMO_SHOPS) {
      for (const n of [d.shop.name, d.shop.legalName.replace(/ \(démo\)$/, "")]) {
        expect(names.has(sha(norm(n))), `name of ${d.shop.slug}`).toBe(false);
        for (const w of norm(n).split(" ")) if (w.length > 2 && !GENERIC.has(w)) expect(words.has(sha(w)), `word « ${w} » of ${d.shop.slug}`).toBe(false);
      }
    }
  });

  it("carries no person's name, no link and no photo", () => {
    const text = JSON.stringify(ST_HENRI_DEMO_SHOPS);
    expect(text).not.toMatch(/https?:\/\//);
    for (const d of ST_HENRI_DEMO_SHOPS) expect(d.team.map((p) => p.name)).toEqual(["Équipe"]);
  });
});

const PRIVATE = join(homedir(), "Documents/krizaka/data/shops/st-henri/points.json");
describe.skipIf(!existsSync(PRIVATE))("against the private survey (runs only where the file is present)", () => {
  const metres = (a: [number, number], b: [number, number]) => Math.hypot((b[0] - a[0]) * 111_320, (b[1] - a[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180));
  it("puts no demo point within 100 m of a surveyed business", () => {
    const survey = Object.values(JSON.parse(readFileSync(PRIVATE, "utf8")) as Record<string, [number, number]>);
    expect(survey.length).toBeGreaterThan(0);
    for (const d of ST_HENRI_DEMO_SHOPS) for (const p of survey) expect(metres([d.zone!.lat, d.zone!.lng], p), d.shop.slug).toBeGreaterThanOrEqual(100);
  });
});
