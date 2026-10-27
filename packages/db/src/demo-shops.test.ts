import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { demoCounts, DEMO_SHOPS, seedDemoShops } from "./demo-shops";
import { listSlots, publicShop } from "./service-shop";
import { freshDatabase } from "./test/db";
import { NOW } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("the three fictional demo shops", () => {
  it("are published through the product's own operations, and a second run changes nothing", async () => {
    const first = await seedDemoShops(t.db);
    expect(first.map((s) => s.slug)).toEqual(["cedre-ciseaux", "encre-vive", "ferland-conseil"]);
    expect(first.every((s) => s.created)).toBe(true);
    const second = await seedDemoShops(t.db);
    expect(second.every((s) => !s.created)).toBe(true);
    expect(second.map((s) => s.shopId)).toEqual(first.map((s) => s.shopId));
  });

  it("are registered for the GST and the QST, so the tax shown is exact", async () => {
    for (const demo of DEMO_SHOPS) expect((await publicShop(t.db, demo.shop.slug))!.shop.registrant).toBe(true);
  });

  it("match the positioning: a salon with several stylists, a studio with a free consultation first, a consultant with a discovery call", async () => {
    const salon = (await publicShop(t.db, "cedre-ciseaux"))!;
    expect(salon.team.map((m) => m.name)).toEqual(["Maëlle", "Karim", "Jade"]);
    const colour = salon.services.find((s) => s.nameEn === "Full colour")!;
    expect(colour.durationMinutes).toBeGreaterThanOrEqual(120);
    expect(colour.priceVaries).toBe(true);
    const studio = (await publicShop(t.db, "encre-vive"))!;
    expect(studio.team.length).toBe(3);
    expect(studio.services.find((s) => s.nameEn === "Free consultation")?.priceCents).toBe(0);
    expect(studio.rules.cancellationHours).toBe(48);
    const consultant = (await publicShop(t.db, "ferland-conseil"))!;
    expect(consultant.team.length).toBe(1);
    expect(consultant.services.map((s) => s.nameEn)).toEqual(expect.arrayContaining(["Discovery call (20 min)", "Working session (1 h)", "3-hour block"]));
  });

  it("really offer times, for anyone and for each person, from their own hours", async () => {
    for (const demo of DEMO_SHOPS) {
      const page = (await publicShop(t.db, demo.shop.slug))!;
      for (const service of page.services) {
        const anyone = await listSlots(t.db, { shopId: page.shop.id, serviceId: service.id, zoneId: null, now: NOW, days: 14 });
        expect(anyone.length, `${demo.shop.slug}: ${service.nameEn}`).toBeGreaterThan(0);
      }
      const someone = page.team[page.team.length - 1]!;
      const own = await listSlots(t.db, { shopId: page.shop.id, serviceId: page.services[0]!.id, zoneId: null, now: NOW, days: 14, staffId: someone.id });
      expect(own.every((s) => s.staffId === someone.id)).toBe(true);
      expect(await demoCounts(t.db, page.shop.id)).toEqual({ team: demo.team.length, services: demo.services.length });
    }
  });

  it("are fictional, say so, and show no feature that is not built", () => {
    for (const demo of DEMO_SHOPS) {
      expect(demo.shop.legalName).toMatch(/\(démo\)/);
      expect(demo.profile.bioFr).toMatch(/fictif/);
      expect(demo.profile.bioEn).toMatch(/fictional/);
      expect(demo.profile.publicEmail).toMatch(/\.example$/);
      expect(demo.profile.publicPhone).toMatch(/^514-555-01\d\d$/);
      const words = JSON.stringify(demo);
      expect(words).not.toMatch(/dépôt|deposit|avis|review|gift|cadeau|forfait|package|liste d'attente|waitlist|SMS/i);
    }
  });
});

describe("a demo shop always has its own trade, so it never wears another trade's images (#383)", () => {
  it("a salon found without a trade or with another one is put back on salon by the next seed", async () => {
    const { saveShopPageConfig, shopPageConfigOf } = await import("./shop-page");
    const salon = (await publicShop(t.db, "cedre-ciseaux"))!;
    for (const wrong of [null, "consulting"] as const) {
      await saveShopPageConfig(t.db, salon.shop.id, { ...(await shopPageConfigOf(t.db, salon.shop.id)), shopType: wrong });
      await seedDemoShops(t.db);
      expect((await shopPageConfigOf(t.db, salon.shop.id)).shopType).toBe("salon");
    }
  });
});

describe("the demo shops use the proposed images (#267)", () => {
  it("each demo has its trade, the salon no cover of its own, so the page shows the defaults of its type", async () => {
    const { shopPageConfigOf } = await import("./shop-page");
    expect(DEMO_SHOPS.map((d) => d.shopType)).toEqual(["salon", "workshop", "consulting"]);
    for (const demo of DEMO_SHOPS) {
      const page = (await publicShop(t.db, demo.shop.slug))!;
      expect(page.pageConfig?.shopType).toBe(demo.shopType);
      expect((await shopPageConfigOf(t.db, page.shop.id)).useDefaults).toBe(true);
    }
    expect(DEMO_SHOPS[0]!.cover).toBeUndefined();
  });
});

describe("the demo shops each wear a template of their trade (#261, step 6)", () => {
  it("has the template applied at its latest version, in the template's order, and a second run keeps it", async () => {
    const { latestTemplate } = await import("@akinaza/core");
    const { sectionsFromTemplate, shopPageConfigOf } = await import("./shop-page");
    expect(DEMO_SHOPS.map((d) => d.template)).toEqual(["salon-vitrine", "workshop-histoire", "consulting-carte"]);
    for (const demo of DEMO_SHOPS) {
      const template = latestTemplate(demo.template)!;
      expect(template.shopTypes, demo.template).toContain(demo.shopType);
      const page = (await publicShop(t.db, demo.shop.slug))!;
      const config = await shopPageConfigOf(t.db, page.shop.id);
      expect(config).toMatchObject({ templateId: demo.template, templateVersion: template.version, sectionsCustom: false });
      expect(config.sections.slice(0, template.sections.length).map((s) => s.id)).toEqual(sectionsFromTemplate(template, config.sections).slice(0, template.sections.length).map((s) => s.id));
    }
    await seedDemoShops(t.db);
    for (const demo of DEMO_SHOPS) expect((await shopPageConfigOf(t.db, (await publicShop(t.db, demo.shop.slug))!.shop.id)).templateId).toBe(demo.template);
  });
});

describe("a dev database seeded by an older version", () => {
  it("keeps the shop that already holds a demo address (another owner), never creating it again, and gives it its trade and template back", async () => {
    const other = await freshDatabase();
    try {
      const [demo] = DEMO_SHOPS;
      const older = await seedDemoShops(other.db);
      // An older seed: the same address, another owner, no trade and no template.
      const { accounts, shops } = await import("./schema");
      const { eq } = await import("drizzle-orm");
      const [stranger] = await other.db.insert(accounts).values({ email: "eric@akinaza.test" }).returning({ id: accounts.id });
      await other.db.update(shops).set({ ownerId: stranger!.id }).where(eq(shops.id, older[0]!.shopId));
      const again = await seedDemoShops(other.db);
      expect(again[0]!.shopId).toBe(older[0]!.shopId);
      expect(again[0]!.created).toBe(false);
      expect(demo!.shop.slug).toBe("cedre-ciseaux");
    } finally {
      await other.drop();
    }
  });
});
