import { shopPresets } from "@krizaka/tokens/shop-presets";

/** The accents the owner may choose within a look: the preset's short, tested list (`shopPresets`), never a free colour. Empty for an unknown look. */
export const acceptedAccents = (presetId: string): readonly string[] => shopPresets.find((p) => p.id === presetId)?.accents ?? [];

/** Every look's accents by look id (what the composer panel offers). */
export const accentsByLook = (): Record<string, readonly string[]> => Object.fromEntries(shopPresets.map((p) => [p.id, p.accents]));
