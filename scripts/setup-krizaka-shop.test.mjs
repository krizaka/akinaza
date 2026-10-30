import { expect, test } from "vitest";

import { LOGO, OFFERS, PHOTOS, SHOP } from "./lib/krizaka-shop.mjs";

test("Krizaka's page is real: no « demo », no invented price, every product in development", () => {
  const text = JSON.stringify({ SHOP, OFFERS, PHOTOS });
  expect(text).not.toMatch(/demo|démo|example|fictif|fictional/i);
  expect(SHOP.slug).toBe("krizaka");
  const products = OFFERS.slice(0, 3);
  expect(products.map((o) => o.nameEn)).toEqual(["Yomizaka", "Akinaza", "Orazaka"]);
  for (const o of products) {
    expect(o.descriptionEn).toMatch(/^In development\./);
    expect(o.descriptionFr).toMatch(/^En développement\./);
    expect(o.descriptionEn).toMatch(/dev\.(yomizaka|akinaza|orazaka)\.com/);
  }
  for (const o of OFFERS) expect([o.priceCents, o.priceVaries], `${o.nameEn}: no list price, it reads « On quote »`).toEqual([0, true]);
  expect(OFFERS[3].nameEn).toBe("Krizaka Entreprise");
  expect(JSON.stringify(OFFERS)).not.toMatch(/\$|\d+\s?(€|\$|CAD)/);
});

test("every photo says what it shows in both languages, and none is the wall poster, a portrait or the defaults manifest", () => {
  for (const p of PHOTOS) {
    expect(p.altFr.length > 10 && p.altEn.length > 10, p.file).toBe(true);
    expect(p.file).not.toMatch(/manifest|poster|portrait|small\.jpg|krizaka\.jpeg/i);
  }
  expect(PHOTOS.filter((p) => p.cover)).toHaveLength(1);
  expect(LOGO.file).not.toMatch(/manifest/);
});
