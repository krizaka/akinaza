import { SHOP_TYPES, TEMPLATES } from "@akinaza/core";
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
