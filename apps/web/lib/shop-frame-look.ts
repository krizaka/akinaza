import { shopPresets } from "@krizaka/tokens/shop-presets";
import type { ShopPage } from "@krizaka/ui/shop";

/** What `ShopFrame` of `@krizaka/ui/shop` wears for a page: the look, its rhythm and motion, and the owner's accent when the look lists it. */
export type ShopFrameLook = { preset: string; density?: "compact" | "airy"; accent?: string; motion?: "still" | "soft" | "paper" | "lively" };

/**
 * The look props of a shop page's frame, all at once, so the page never wires them one by one (the look's motion and its airy
 * rhythm were dropped that way). The density is the document's, else the look's; the motion is the look's; the owner's accent
 * (`shop_page.accent`, chosen against the draft's look) is worn only when the shown look lists it, else the look's own tested
 * accent. Same rules as `shopFrameLook` of `@krizaka/ui/shop/look`, which replaces this bridge on the next @krizaka/ui bump.
 */
export function shopFrameLook(page: Pick<ShopPage, "density"> & { preset: { id: string } }, accent?: string | null): ShopFrameLook {
  const preset = shopPresets.find((p) => p.id === page.preset.id);
  const density = page.density ?? preset?.density;
  const motion = preset?.motion;
  const listed = accent && preset?.accents.includes(accent) ? accent : undefined;
  return { preset: page.preset.id, ...(density ? { density } : {}), ...(listed ? { accent: listed } : {}), ...(motion ? { motion } : {}) };
}
