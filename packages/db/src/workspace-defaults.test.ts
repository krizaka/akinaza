import { INVOICE_STATE, SHOP_TYPES } from "@akinaza/core";
import { checkKindConfig, checkMove, checkViewFilters, MARKERS, type StatusSet } from "@krizaka/organize/contract";
import { describe, expect, it } from "vitest";

import { CLIENT_KIND, INVOICE_KIND, INVOICE_STATUS_SET, KIND_DEFAULTS, presetVariant, TAG_WRITERS } from "./workspace-defaults";

describe("the administrator's defaults of the workspace (akinaza#337)", () => {
  it.each(KIND_DEFAULTS.map((k) => [k.kind, k] as const))("%s: the configuration is valid for the package", (_kind, config) => {
    expect(() => checkKindConfig(config)).not.toThrow();
  });

  it("only the owner and the manager write tags: staff read, a client never sees them", () => {
    expect([...TAG_WRITERS]).toEqual(["owner", "manager"]);
    for (const kind of KIND_DEFAULTS) expect(kind.tags.writers).toEqual(["owner", "manager"]);
  });

  it("every trade has a default tag set in French and in English, the same tags, with markers of the closed palette", () => {
    for (const trade of [...SHOP_TYPES, "default"]) {
      const fr = CLIENT_KIND.tags.presets[trade];
      const en = CLIENT_KIND.tags.presets[`${trade}_en`];
      expect(fr?.length, `${trade} (fr)`).toBeGreaterThanOrEqual(3);
      expect(en?.map((t) => t.marker), `${trade} (en)`).toEqual(fr?.map((t) => t.marker));
      for (const preset of [...fr!, ...en!]) expect(MARKERS).toContain(preset.marker);
    }
  });

  it("the presets never name a restaurant, a bar or a café (Akinaza does not serve them)", () => {
    const words = JSON.stringify(KIND_DEFAULTS.map((k) => k.tags.presets)).toLowerCase();
    expect(words).not.toMatch(/restaurant|\bbar\b|caf[ée]|resto/);
  });

  it("falls back to the default set of the language when a trade has none", () => {
    const has = (v: string) => ["salon", "salon_en", "default", "default_en"].includes(v);
    expect(presetVariant("salon", "fr", has)).toBe("salon");
    expect(presetVariant("salon", "en", has)).toBe("salon_en");
    expect(presetVariant("cleaning", "fr", has)).toBe("default");
    expect(presetVariant("cleaning", "en", has)).toBe("default_en");
  });

  it("an invoice's state is a DERIVED set of exactly the states `invoiceState` computes: no move exists", () => {
    expect(INVOICE_STATUS_SET.mode).toBe("derived");
    expect(INVOICE_STATUS_SET.transitions).toEqual([]);
    expect(INVOICE_STATUS_SET.states.map((s) => s.key).sort()).toEqual(Object.values(INVOICE_STATE).sort());
    for (const from of Object.values(INVOICE_STATE)) {
      for (const to of Object.values(INVOICE_STATE)) expect(() => checkMove(INVOICE_STATUS_SET, { from, to, role: "owner" }), `${from} → ${to}`).toThrowError(expect.objectContaining({ code: "STATUS_DERIVED" }));
    }
  });

  it("the system views of the invoices name states of the set", () => {
    const set: StatusSet = INVOICE_KIND.status!;
    for (const view of INVOICE_KIND.views) expect(() => checkViewFilters(view.filters, set), view.key).not.toThrow();
  });

  it("clients have no status set: nothing to move, nothing derived", () => {
    expect(CLIENT_KIND.status).toBeNull();
  });
});
