import type { TextStyle } from "@krizaka/ui/text-style/server";

import type { Cahier, Layout, Template, TemplateTextStyle } from "./schema";
import { CAHIER_VERSION, templateSchema } from "./schema";

const style = (font: TemplateTextStyle["font"], size: TemplateTextStyle["size"], weight: TemplateTextStyle["weight"], italic = false): TemplateTextStyle => ({ font, size, weight, italic });

type Section = { id: Template["sections"][number]["id"]; variant: string };

/** « id:variant id … » (variant « default » when omitted) as the sections of a layout. */
const sections = (spec: string): Section[] =>
  spec.split(" ").map((token) => {
    const [id, variant = "default"] = token.split(":");
    return { id: id as Section["id"], variant };
  });

/** The section order of each layout, after the hero (docs/design/storefront-templates.md, section 5). */
const LAYOUT_SECTIONS: Record<Layout, Section[]> = {
  vitrine: sections("services:grid gallery:grid team hours zones trust"),
  carte: sections("services:list hours team trust gallery:grid"),
  histoire: sections("trust:story gallery:taped services:grid hours team zones"),
};

type Row = { id: string; shopType: Template["shopTypes"][number]; layout: Layout; hue: Template["hue"]; paper: Template["paper"]; title: TemplateTextStyle; body: TemplateTextStyle; price: TemplateTextStyle; slots: Template["slots"] };

const rows: Row[] = [
  { id: "salon-vitrine", shopType: "salon", layout: "vitrine", hue: "brand-akinaza", paper: "plain", title: style("display", "3xl", 700), body: style("body", "md", 400), price: style("body", "md", 600), slots: { cover: "default", gallery: "default", service: "default" } },
  { id: "salon-carte", shopType: "salon", layout: "carte", hue: "brand-akinaza", paper: "ruled", title: style("display", "2xl", 600), body: style("body", "md", 400), price: style("body", "lg", 700), slots: { cover: "default", gallery: "none", service: "default" } },
  { id: "coaching-vitrine", shopType: "coaching", layout: "vitrine", hue: "cyan", paper: "dot-grid", title: style("display", "3xl", 700), body: style("body", "md", 400), price: style("body", "md", 600), slots: { cover: "default", gallery: "default", service: "none" } },
  { id: "coaching-histoire", shopType: "coaching", layout: "histoire", hue: "sky", paper: "kraft", title: style("display", "3xl", 600, true), body: style("body", "lg", 400), price: style("body", "md", 600), slots: { cover: "default", gallery: "default", service: "none" } },
  { id: "workshop-histoire", shopType: "workshop", layout: "histoire", hue: "steel", paper: "kraft", title: style("display", "3xl", 700), body: style("body", "md", 400), price: style("body", "md", 500), slots: { cover: "default", gallery: "default", service: "none" } },
  { id: "workshop-carte", shopType: "workshop", layout: "carte", hue: "steel", paper: "ruled", title: style("display", "2xl", 700), body: style("body", "md", 400), price: style("body", "lg", 700), slots: { cover: "default", gallery: "none", service: "default" } },
  { id: "cleaning-vitrine", shopType: "cleaning", layout: "vitrine", hue: "sky", paper: "plain", title: style("display", "3xl", 700), body: style("body", "md", 400), price: style("body", "lg", 700), slots: { cover: "default", gallery: "default", service: "default" } },
  { id: "cleaning-carte", shopType: "cleaning", layout: "carte", hue: "cyan", paper: "dot-grid", title: style("display", "2xl", 600), body: style("body", "md", 400), price: style("body", "lg", 700), slots: { cover: "default", gallery: "none", service: "default" } },
  { id: "pets-histoire", shopType: "pets", layout: "histoire", hue: "brand-akinaza", paper: "kraft", title: style("display", "3xl", 700), body: style("body", "lg", 400), price: style("body", "md", 500), slots: { cover: "default", gallery: "default", service: "none" } },
  { id: "pets-vitrine", shopType: "pets", layout: "vitrine", hue: "brand-akinaza", paper: "dot-grid", title: style("display", "3xl", 700), body: style("body", "md", 400), price: style("body", "md", 500), slots: { cover: "default", gallery: "default", service: "none" } },
  { id: "consulting-carte", shopType: "consulting", layout: "carte", hue: "indigo", paper: "plain", title: style("display", "2xl", 600), body: style("body", "md", 400), price: style("body", "lg", 600), slots: { cover: "default", gallery: "none", service: "none" } },
  { id: "consulting-histoire", shopType: "consulting", layout: "histoire", hue: "ink", paper: "ruled", title: style("display", "3xl", 600), body: style("body", "lg", 400), price: style("body", "md", 500), slots: { cover: "default", gallery: "default", service: "none" } },
];

/** The catalogue, as data: every template is parsed (a malformed one stops the build, not a page). Version 1 of each. */
export const TEMPLATES: readonly Template[] = rows.map((r) =>
  templateSchema.parse({
    id: r.id,
    version: 1,
    shopTypes: [r.shopType],
    layout: r.layout,
    sections: LAYOUT_SECTIONS[r.layout].map((s) => ({ ...s, visible: true })),
    slots: r.slots,
    hue: r.hue,
    paper: r.paper,
    textStyles: { title: r.title, body: r.body, price: r.price },
  }),
);

/**
 * The notebook (`cahier`) storefront, version 2 of each template (docs/design/cahier-storefront.md § 8.2). Side by side with version 1 in the schema, **not offered** yet:
 * `templatesFor` and the picker read `TEMPLATES` (version 1); a shop that applied `@2` resolves it (`resolveTemplate`), and « update available » (#316) will offer it.
 */
const full = (font: TextStyle["font"], size: TextStyle["size"], weight: TextStyle["weight"], italic = false): TextStyle => ({
  font,
  size,
  weight,
  leading: "normal",
  tracking: "normal",
  align: "start",
  case: "none",
  italic,
  tone: "primary",
});

/** The body order of each layout at version 2, after the fixed head (the owner's own order still wins). `reels` is not placed: the latest reel is a wall item. */
const LAYOUT_SECTIONS_V2: Record<Layout, Section[]> = {
  vitrine: sections("services:index wall announcements team:polaroid hours:card zones reviews:stamp trust gallery:grid follow"),
  carte: sections("services:list hours:card team:polaroid trust reviews:stamp wall gallery:grid announcements follow"),
  histoire: sections("trust:story gallery:taped services:index hours:card zones wall announcements team:polaroid reviews:stamp follow"),
};

type RowV2 = {
  id: string;
  paper: Template["paper"];
  hue: Template["hue"];
  cahier: Omit<Cahier, "noteHold" | "doodles"> & { doodles?: Cahier["doodles"] };
  /** title size and italic; body font/size; price size and weight (the text face is cut in 400, 600 and 700 only). */
  title: [TextStyle["size"], boolean?];
  body: [TextStyle["size"]];
  price: [TextStyle["size"], TextStyle["weight"]];
};

const cah = (sign: Cahier["sign"], heroTape: Cahier["heroTape"], heroTilt: number, divider: Cahier["divider"], wallTexture: Cahier["wallTexture"], doodles?: Cahier["doodles"]): RowV2["cahier"] => ({
  sign,
  heroTape,
  heroTilt,
  divider,
  wallTexture,
  doodles,
});

const rowsV2: RowV2[] = [
  { id: "salon-vitrine", paper: "plain", hue: "brand-akinaza", cahier: cah("painted", "corners", -1.2, "wave", "brick", [{ kind: "arrow", near: "book" }]), title: ["3xl"], body: ["md"], price: ["lg", 600] },
  { id: "salon-carte", paper: "ruled", hue: "brand-akinaza", cahier: cah("painted", "top", 0, "stroke", "plaster"), title: ["2xl"], body: ["md"], price: ["lg", 700] },
  { id: "coaching-vitrine", paper: "dot-grid", hue: "cyan", cahier: cah("neon", "corners", -1.2, "dash", "ridge", [{ kind: "star", near: "services" }]), title: ["3xl"], body: ["md"], price: ["lg", 600] },
  { id: "coaching-histoire", paper: "kraft", hue: "sky", cahier: cah("enamel", "corners", -1.5, "wave", "ridge"), title: ["3xl", true], body: ["lg"], price: ["md", 600] },
  { id: "workshop-histoire", paper: "kraft", hue: "steel", cahier: cah("enamel", "corners", -1.5, "stroke", "brick", [{ kind: "circle", near: "wall" }]), title: ["3xl"], body: ["md"], price: ["md", 600] },
  { id: "workshop-carte", paper: "ruled", hue: "steel", cahier: cah("painted", "top", 0, "dash", "ridge"), title: ["2xl"], body: ["md"], price: ["lg", 700] },
  { id: "cleaning-vitrine", paper: "plain", hue: "sky", cahier: cah("painted", "corners", -1, "dash", "plaster"), title: ["3xl"], body: ["md"], price: ["lg", 700] },
  { id: "cleaning-carte", paper: "dot-grid", hue: "cyan", cahier: cah("none", "top", 0, "stroke", "plaster"), title: ["2xl"], body: ["md"], price: ["lg", 700] },
  { id: "pets-histoire", paper: "kraft", hue: "brand-akinaza", cahier: cah("enamel", "corners", -1.5, "wave", "plaster", [{ kind: "arrow", near: "book" }]), title: ["3xl"], body: ["lg"], price: ["md", 600] },
  { id: "pets-vitrine", paper: "dot-grid", hue: "brand-akinaza", cahier: cah("painted", "corners", -1.2, "wave", "brick"), title: ["3xl"], body: ["md"], price: ["md", 600] },
  { id: "consulting-carte", paper: "plain", hue: "indigo", cahier: cah("none", "top", 0, "stroke", "plaster"), title: ["2xl"], body: ["md"], price: ["lg", 600] },
  { id: "consulting-histoire", paper: "ruled", hue: "ink", cahier: cah("enamel", "top", -1, "stroke", "zellige"), title: ["3xl"], body: ["lg"], price: ["md", 600] },
];

/** Version 2 of the twelve templates, each parsed (a malformed one stops the build). Same trade, layout and media slots as its version 1; the display face is cut in one weight (400). */
export const TEMPLATES_V2: readonly Template[] = rowsV2.map((r) => {
  const v1 = TEMPLATES.find((t) => t.id === r.id)!;
  return templateSchema.parse({
    id: r.id,
    version: CAHIER_VERSION,
    shopTypes: v1.shopTypes,
    layout: v1.layout,
    sections: LAYOUT_SECTIONS_V2[v1.layout].map((s) => ({ ...s, visible: true })),
    slots: v1.slots,
    hue: r.hue,
    paper: r.paper,
    textStyles: { title: full("display", r.title[0], 400, r.title[1] ?? false), body: full("text", r.body[0], 400), price: full("text", r.price[0], r.price[1]) },
    cahier: { noteHold: r.cahier.heroTape === "top" ? "pin" : "tape", ...r.cahier, doodles: r.cahier.doodles ?? [] },
  });
});
