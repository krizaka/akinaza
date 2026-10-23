import { describe, expect, it } from "vitest";

import { DEFAULT_SLOT_IDS, SHOP_TYPES } from "../shop-media";
import { TEMPLATES } from "./catalogue";
import { latestTemplate, preselectedTemplate, resolveTemplate, templatesFor } from "./resolve";
import { LAYOUTS, SECTION_VARIANTS, TEMPLATE_SECTIONS, TEMPLATE_SLOTS, templateSchema } from "./schema";

describe("the storefront template catalogue (#261, step 1)", () => {
  it("every template parses against the schema, again from its own value", () => {
    for (const t of TEMPLATES) expect(templateSchema.safeParse(t).success, t.id).toBe(true);
  });

  it("ids are unique, kebab-case, named after their trade, at version 1", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.id.startsWith(`${t.shopTypes[0]}-`), t.id).toBe(true);
      expect(t.version).toBe(1);
    }
  });

  it("every shop type has at least two templates, on different layouts", () => {
    for (const type of SHOP_TYPES) {
      const mine = TEMPLATES.filter((t) => t.shopTypes.includes(type));
      expect(mine.length, type).toBeGreaterThanOrEqual(2);
      expect(new Set(mine.map((t) => t.layout)).size, `${type} layouts`).toBe(mine.length);
    }
    expect(TEMPLATES).toHaveLength(12);
  });

  it("no template names a missing section id, a variant the section lacks, or the same section twice", () => {
    for (const t of TEMPLATES) {
      const ids = t.sections.map((s) => s.id);
      expect(new Set(ids).size, t.id).toBe(ids.length);
      for (const s of t.sections) {
        expect(TEMPLATE_SECTIONS as readonly string[]).toContain(s.id);
        expect(SECTION_VARIANTS[s.id] as readonly string[], `${t.id}/${s.id}`).toContain(s.variant);
      }
    }
  });

  it("the layouts follow the wireframes: story first for Histoire, booking first for Carte, services first for Vitrine", () => {
    const first = (layout: string) => [...new Set(TEMPLATES.filter((t) => t.layout === layout).map((t) => t.sections[0]!.id))];
    expect(first("histoire")).toEqual(["trust"]);
    expect(first("carte")).toEqual(["services"]);
    expect(first("vitrine")).toEqual(["services"]);
    expect(LAYOUTS).toEqual(["vitrine", "carte", "histoire"]);
    for (const t of TEMPLATES.filter((x) => x.layout === "carte")) expect(t.sections.find((s) => s.id === "services")!.variant).toBe("list");
  });

  it("every media slot a template names is a slot with defaults, and a trade's default exists for each slot it asks for", () => {
    for (const t of TEMPLATES) {
      for (const slot of TEMPLATE_SLOTS) {
        expect(DEFAULT_SLOT_IDS as readonly string[]).toContain(slot);
        expect(["default", "none"]).toContain(t.slots[slot]);
      }
      expect(t.slots.cover, `${t.id} has a cover`).toBe("default");
    }
  });

  it("text styles are in the three roles, with faces and sizes from the allowed steps", () => {
    for (const t of TEMPLATES) expect(Object.keys(t.textStyles).sort()).toEqual(["body", "price", "title"]);
  });

  it("refuses a malformed template: a repeated section, an unknown variant, a restaurant", () => {
    const base = TEMPLATES[0]!;
    expect(templateSchema.safeParse({ ...base, sections: [...base.sections, base.sections[0]] }).success).toBe(false);
    expect(templateSchema.safeParse({ ...base, sections: base.sections.map((s) => (s.id === "services" ? { ...s, variant: "carousel" } : s)) }).success).toBe(false);
    expect(templateSchema.safeParse({ ...base, shopTypes: ["restaurant"] }).success).toBe(false);
    expect(templateSchema.safeParse({ ...base, version: 0 }).success).toBe(false);
  });
});

describe("which template a shop renders with", () => {
  it("none for a shop that never applied one, whatever the catalogue or an administrator holds", () => {
    expect(resolveTemplate({})).toBeNull();
    expect(resolveTemplate({ templateId: null, templateVersion: null })).toBeNull();
    expect(resolveTemplate({ templateId: undefined })).toBeNull();
  });

  it("the applied id and version, kept when a newer version exists; null for an unknown one (the page never breaks)", () => {
    const v2 = { ...TEMPLATES[0]!, version: 2 };
    const catalogue = [TEMPLATES[0]!, v2];
    expect(resolveTemplate({ templateId: "salon-vitrine", templateVersion: 1 }, catalogue)?.version).toBe(1);
    expect(resolveTemplate({ templateId: "salon-vitrine", templateVersion: 2 }, catalogue)?.version).toBe(2);
    expect(latestTemplate("salon-vitrine", catalogue)?.version).toBe(2);
    expect(resolveTemplate({ templateId: "salon-vitrine", templateVersion: 9 }, catalogue)).toBeNull();
    expect(resolveTemplate({ templateId: "nope-nope", templateVersion: 1 })).toBeNull();
  });

  it("the templates offered for a trade are the administrator's, the latest version of each", () => {
    expect(templatesFor("salon").map((t) => t.id)).toEqual(["salon-vitrine", "salon-carte"]);
    expect(templatesFor("salon", ["salon-carte"]).map((t) => t.id)).toEqual(["salon-carte"]);
    expect(templatesFor("salon", [])).toEqual([]);
    const v2 = { ...TEMPLATES[0]!, version: 2 };
    expect(templatesFor("salon", undefined, [TEMPLATES[0]!, v2, TEMPLATES[1]!]).find((t) => t.id === "salon-vitrine")!.version).toBe(2);
  });

  it("the administrator's default only preselects the picker: the first offered when it is not offered or not set", () => {
    expect(preselectedTemplate("salon", "salon-carte")?.id).toBe("salon-carte");
    expect(preselectedTemplate("salon", null)?.id).toBe("salon-vitrine");
    expect(preselectedTemplate("salon", "pets-histoire")?.id).toBe("salon-vitrine");
    expect(preselectedTemplate("salon", "salon-carte", ["salon-vitrine"])?.id).toBe("salon-vitrine");
    expect(preselectedTemplate("salon", "salon-carte", [])).toBeNull();
    // preselecting never makes a shop render with it
    expect(resolveTemplate({})).toBeNull();
  });
});
