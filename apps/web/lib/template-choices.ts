import { latestTemplate, preselectedTemplate, type ShopType, type Template, templatesFor } from "@akinaza/core";
import type { ShopPageConfig } from "@akinaza/db";

/**
 * What the template picker needs for one shop (#261, step 4): the templates the administrator offers for its trade (latest version each), the one the picker
 * preselects (the administrator's default for the trade when offered, else the first), the one the shop applied, and whether the owner reordered or hid sections by hand
 * (a template then asks before replacing that order). `null` while the administrator's switch is off: no picker.
 */
export interface TemplateChoices {
  shopType: ShopType;
  choices: Template[];
  /** Preselects only: nothing applies until the owner chooses. */
  preselected: string | null;
  current: { id: string; version: number } | null;
  /** The newer version of the applied template, when one is out (step 5): the shop keeps its own until the owner updates. */
  updateAvailable: { version: number } | null;
  sectionsCustom: boolean;
}

export interface TemplateRules {
  enabled: boolean;
  offered: readonly string[];
  defaults: Record<ShopType, string>;
}

export function templateChoices(rules: TemplateRules, shopType: ShopType, config: Pick<ShopPageConfig, "templateId" | "templateVersion" | "sectionsCustom"> | null, catalogue?: readonly Template[]): TemplateChoices | null {
  if (!rules.enabled) return null;
  const choices = templatesFor(shopType, rules.offered, catalogue);
  const current = config?.templateId && config.templateVersion ? { id: config.templateId, version: config.templateVersion } : null;
  const latest = current ? latestTemplate(current.id, catalogue) : null;
  return {
    shopType,
    choices,
    preselected: preselectedTemplate(shopType, rules.defaults[shopType], rules.offered, catalogue)?.id ?? null,
    current,
    updateAvailable: latest && current && latest.version > current.version ? { version: latest.version } : null,
    sectionsCustom: config?.sectionsCustom ?? false,
  };
}

/** The choices of every trade (the picker at shop creation, before the trade is known), or null while the switch is off. */
export function templateChoicesByTrade(rules: TemplateRules, types: readonly ShopType[]): Record<ShopType, TemplateChoices> | null {
  if (!rules.enabled) return null;
  return Object.fromEntries(types.map((type) => [type, templateChoices(rules, type, null)!])) as Record<ShopType, TemplateChoices>;
}
