import { parseTextStyle, type TextStyle } from "@krizaka/ui/text-style/server";
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
  services: ["grid", "list", "index"],
  gallery: ["grid", "taped"],
  trust: ["default", "story"],
  team: ["default", "polaroid"],
  hours: ["default", "card"],
  zones: ["default"],
  wall: ["default"],
  reels: ["default"],
  announcements: ["default"],
  reviews: ["default", "stamp"],
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

/** The version of the notebook (`cahier`) storefront: a template at this version or later carries the `cahier` block and full `TextStyle`s (docs/design/cahier-storefront.md § 8.2). */
export const CAHIER_VERSION = 2;

/** The `cahier` block of a v2 template: the notebook's hand-made parts, as data. Absent = a v1 template, drawn as today. */
export const cahierSchema = z.object({
  /** The sign over the shop's name; the owner may change it. `none` is also what a name over 48 characters gets. */
  sign: z.enum(["painted", "enamel", "neon", "none"]),
  heroTape: z.enum(["corners", "top", "none"]),
  /** Degrees; 0 for the compact `carte` head. */
  heroTilt: z.number().min(-2).max(2),
  divider: z.enum(["stroke", "wave", "dash"]),
  /** The wall's default texture; the owner may change it. */
  wallTexture: z.enum(["brick", "zellige", "ridge", "plaster"]),
  noteHold: z.enum(["tape", "pin"]),
  doodles: z.array(z.object({ kind: z.enum(["arrow", "circle", "star", "wave"]), near: z.enum(["book", "services", "wall"]) })).max(2),
});
export type Cahier = z.infer<typeof cahierSchema>;

/**
 * A full `TextStyle` of `@krizaka/ui` (every key present, every value from its tables), checked with the library's own `parseTextStyle`. The pen (`cahier`) is for
 * notes, never for a title, a body or a price (the text roles of a template).
 */
export const fullTextStyleSchema = z.custom<TextStyle>((value) => JSON.stringify(parseTextStyle(value)) === JSON.stringify(sortLike(value)) && (value as TextStyle).font !== "cahier", {
  message: "a complete TextStyle of @krizaka/ui, and never the pen",
});

/** The value with its keys in the order `parseTextStyle` answers, so two equal styles compare equal as text. */
function sortLike(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const order = Object.keys(parseTextStyle({}));
  return Object.fromEntries(order.filter((k) => k in value).map((k) => [k, (value as Record<string, unknown>)[k]]));
}

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
    /** v1: the three legacy styles; v2: three full `TextStyle`s (see `CAHIER_VERSION`). */
    textStyles: z.object({
      title: z.union([fullTextStyleSchema, textStyleSchema]),
      body: z.union([fullTextStyleSchema, textStyleSchema]),
      price: z.union([fullTextStyleSchema, textStyleSchema]),
    }),
    /** Present from `CAHIER_VERSION` on. */
    cahier: cahierSchema.optional(),
  })
  .superRefine((t, ctx) => {
    const notebook = t.version >= CAHIER_VERSION;
    if (notebook && !t.cahier) ctx.addIssue({ code: "custom", message: `version ${t.version} carries the cahier block` });
    if (!notebook && t.cahier) ctx.addIssue({ code: "custom", message: "a v1 template has no cahier block" });
    for (const role of TEXT_ROLES) {
      const full = fullTextStyleSchema.safeParse(t.textStyles[role]).success;
      if (full !== notebook) ctx.addIssue({ code: "custom", message: `${role}: ${notebook ? "a v2 template uses full TextStyles" : "a v1 template uses the legacy styles"}` });
    }
    const ids = t.sections.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "a section occurs once" });
    for (const s of t.sections) {
      if (!(SECTION_VARIANTS[s.id] as readonly string[]).includes(s.variant)) ctx.addIssue({ code: "custom", message: `${s.id} has no variant ${s.variant}` });
    }
  });
export type Template = z.infer<typeof templateSchema>;
