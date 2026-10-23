import { z } from "zod";

import { SHOP_TYPES } from "../shop-media";

/**
 * A storefront template (#261, docs/design/storefront-templates.md, option C): a versioned record of **section order, section variants, media slot names, a hue and the
 * default text styles**. It never holds content: the texts are the shop's (and their translations), the media are the shop's or the defaults of its trade. The page
 * renders the existing section components in the template's order; the owner's own order and visibility are overrides over it.
 */

/** The sections a template can order. `hero` is not here: it is always first. `trust` (story, contact, policies) becomes orderable in step 3 (it is injected before `gallery` today). */
export const TEMPLATE_SECTIONS = ["trust", "services", "team", "hours", "zones", "gallery", "wall", "reels", "announcements", "reviews", "follow"] as const;
export type TemplateSection = (typeof TEMPLATE_SECTIONS)[number];

/** The three layouts that carry the structure (see the doc's wireframes). */
export const LAYOUTS = ["vitrine", "carte", "histoire"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** How a section is drawn: each section component knows its variants; `default` is today's drawing. */
export const SECTION_VARIANTS = {
  services: ["grid", "list"],
  gallery: ["grid", "taped"],
  trust: ["default", "story"],
  team: ["default"],
  hours: ["default"],
  zones: ["default"],
  wall: ["default"],
  reels: ["default"],
  announcements: ["default"],
  reviews: ["default"],
  follow: ["default"],
} as const satisfies Record<TemplateSection, readonly string[]>;

export const HUES = ["brand-akinaza", "cobalt", "sky", "cyan", "indigo", "steel", "ink"] as const;
export const PAPERS = ["plain", "dot-grid", "kraft", "ruled"] as const;

/** The media slots a template names (`default`: the trade's proposed images, `none`: nothing is proposed). */
export const TEMPLATE_SLOTS = ["cover", "gallery", "service"] as const;

/**
 * A text style, in the vocabulary of krizaka-ui#561's `TextStyle` (font, size step, weight, italic, case, tone): the faces are roles here (`display`, `body`) and map to
 * `@krizaka/fonts` when the control ships. Never a free font name, never a pixel size.
 */
export const textStyleSchema = z.object({
  font: z.enum(["display", "body"]),
  size: z.enum(["md", "lg", "xl", "2xl", "3xl"]),
  weight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
  italic: z.boolean().default(false),
});
export type TemplateTextStyle = z.infer<typeof textStyleSchema>;

export const TEXT_ROLES = ["title", "body", "price"] as const;

const sectionSchema = z.object({ id: z.enum(TEMPLATE_SECTIONS), variant: z.string().min(1), visible: z.boolean() });

export const templateSchema = z
  .object({
    /** `salon-vitrine`: stable, kebab-case, the trade first. */
    id: z.string().regex(/^[a-z]+-[a-z]+$/),
    /** Bumped when the template improves; a shop keeps the version it applied. */
    version: z.number().int().min(1),
    shopTypes: z.array(z.enum(SHOP_TYPES)).min(1),
    layout: z.enum(LAYOUTS),
    sections: z.array(sectionSchema).min(3),
    slots: z.record(z.enum(TEMPLATE_SLOTS), z.enum(["default", "none"])),
    hue: z.enum(HUES),
    paper: z.enum(PAPERS),
    textStyles: z.object({ title: textStyleSchema, body: textStyleSchema, price: textStyleSchema }),
  })
  .superRefine((t, ctx) => {
    const ids = t.sections.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "a section occurs once" });
    for (const s of t.sections) {
      if (!(SECTION_VARIANTS[s.id] as readonly string[]).includes(s.variant)) ctx.addIssue({ code: "custom", message: `${s.id} has no variant ${s.variant}` });
    }
  });
export type Template = z.infer<typeof templateSchema>;
