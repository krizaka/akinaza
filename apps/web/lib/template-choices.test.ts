import { SHOP_TYPES, TEMPLATES, TEMPLATES_V2 } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { templateChoices, templateChoicesByTrade, type TemplateRules } from "./template-choices";

const all = TEMPLATES.map((t) => t.id);
const rules = (over: Partial<TemplateRules> = {}): TemplateRules => ({ enabled: true, offered: all, defaults: { salon: "salon-carte", coaching: "coaching-vitrine", workshop: "workshop-histoire", cleaning: "cleaning-vitrine", pets: "pets-histoire", consulting: "consulting-carte" }, ...over });

describe("what the template picker is given (#261, step 4)", () => {
  it("is nothing while the administrator's switch is off", () => {
    expect(templateChoices(rules({ enabled: false }), "salon", null)).toBeNull();
    expect(templateChoicesByTrade(rules({ enabled: false }), SHOP_TYPES)).toBeNull();
  });

  it("offers only the trade's templates the administrator offers, and preselects the administrator's default for the trade", () => {
    const c = templateChoices(rules(), "salon", null)!;
    expect(c.choices.map((t) => t.id)).toEqual(["salon-vitrine", "salon-carte"]);
    expect(c.preselected).toBe("salon-carte");
    expect(c.current).toBeNull();
    expect(c.sectionsCustom).toBe(false);
    const narrowed = templateChoices(rules({ offered: ["salon-vitrine", "pets-histoire"] }), "salon", null)!;
    expect(narrowed.choices.map((t) => t.id)).toEqual(["salon-vitrine"]);
  });

  it("preselects the first offered template when the administrator's default is not offered, and none when nothing is", () => {
    expect(templateChoices(rules({ offered: ["salon-vitrine"] }), "salon", null)!.preselected).toBe("salon-vitrine");
    const none = templateChoices(rules({ offered: ["pets-histoire"] }), "salon", null)!;
    expect(none.choices).toEqual([]);
    expect(none.preselected).toBeNull();
  });

  it("says the template the shop applied and whether the owner customised the order; a half-set pair is no template", () => {
    const c = templateChoices(rules(), "salon", { templateId: "salon-vitrine", templateVersion: 1, sectionsCustom: true })!;
    expect(c.current).toEqual({ id: "salon-vitrine", version: 1 });
    expect(c.sectionsCustom).toBe(true);
    expect(templateChoices(rules(), "salon", { templateId: "salon-vitrine", templateVersion: null, sectionsCustom: false })!.current).toBeNull();
  });

  it("at creation, every trade has its choices and its preselection", () => {
    const byTrade = templateChoicesByTrade(rules(), SHOP_TYPES)!;
    for (const type of SHOP_TYPES) {
      expect(byTrade[type].choices.length, type).toBeGreaterThanOrEqual(2);
      expect(byTrade[type].choices.every((t) => t.shopTypes.includes(type)), type).toBe(true);
      expect(byTrade[type].preselected, type).toBe(rules().defaults[type]);
      expect(byTrade[type].current).toBeNull();
    }
  });
});

describe("a template that improved (#261, step 5)", () => {
  const two = { ...TEMPLATES.find((t) => t.id === "salon-vitrine")!, version: 2 };
  const catalogue = [...TEMPLATES, two];

  it("says a newer version is out for the applied template, and offers the latest version in the tiles; a shop on the latest has nothing to update", () => {
    const c = templateChoices(rules(), "salon", { templateId: "salon-vitrine", templateVersion: 1, sectionsCustom: false }, catalogue)!;
    expect(c.current).toEqual({ id: "salon-vitrine", version: 1 });
    expect(c.updateAvailable).toEqual({ version: 2 });
    expect(c.choices.find((t) => t.id === "salon-vitrine")!.version).toBe(2);
    expect(c.choices.filter((t) => t.id === "salon-vitrine")).toHaveLength(1);
    expect(templateChoices(rules(), "salon", { templateId: "salon-vitrine", templateVersion: 2, sectionsCustom: false }, catalogue)!.updateAvailable).toBeNull();
    expect(templateChoices(rules(), "salon", null, catalogue)!.updateAvailable).toBeNull();
  });
});

describe("the notebook's catalogue (akinaza#316)", () => {
  it("offers « update available » from the shipped @1 to the shipped @2, and the trade's templates at @2", () => {
    const catalogue = [...TEMPLATES, ...TEMPLATES_V2];
    const c = templateChoices(rules(), "salon", { templateId: "salon-vitrine", templateVersion: 1, sectionsCustom: false }, catalogue)!;
    expect(c.updateAvailable).toEqual({ version: 2 });
    expect(c.choices.every((x) => x.version === 2)).toBe(true);
    expect(templateChoices(rules(), "salon", { templateId: "salon-vitrine", templateVersion: 1, sectionsCustom: false })!.updateAvailable).toBeNull();
  });
});
