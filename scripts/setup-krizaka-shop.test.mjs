import assert from "node:assert/strict";
import { test } from "node:test";

import { LOGO, OFFERS, PHOTOS, SHOP } from "./lib/krizaka-shop.mjs";

test("Krizaka's page is real: no « demo », no invented price, every product in development", () => {
  const text = JSON.stringify({ SHOP, OFFERS, PHOTOS });
  assert.doesNotMatch(text, /demo|démo|example|fictif|fictional/i);
  assert.equal(SHOP.slug, "krizaka");
  const products = OFFERS.slice(0, 3);
  assert.deepEqual(products.map((o) => o.nameEn), ["Yomizaka", "Akinaza", "Orazaka"]);
  for (const o of products) {
    assert.match(o.descriptionEn, /^In development\./);
    assert.match(o.descriptionFr, /^En développement\./);
    assert.match(o.descriptionEn, /dev\.(yomizaka|akinaza|orazaka)\.com/);
  }
  for (const o of OFFERS) assert.deepEqual([o.priceCents, o.priceVaries], [0, true], `${o.nameEn}: no list price, it reads « On quote »`);
  assert.equal(OFFERS[3].nameEn, "Krizaka Entreprise");
  assert.doesNotMatch(JSON.stringify(OFFERS), /\$|\d+\s?(€|\$|CAD)/);
});

test("every photo says what it shows in both languages, and none is the wall poster, a portrait or the defaults manifest", () => {
  for (const p of PHOTOS) {
    assert.ok(p.altFr.length > 10 && p.altEn.length > 10, p.file);
    assert.doesNotMatch(p.file, /manifest|poster|portrait|small\.jpg|krizaka\.jpeg/i);
  }
  assert.equal(PHOTOS.filter((p) => p.cover).length, 1);
  assert.doesNotMatch(LOGO.file, /manifest/);
});
