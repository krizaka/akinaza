import type { Layout, Template, TemplateTextStyle } from "./schema";
import { templateSchema } from "./schema";

const style = (font: TemplateTextStyle["font"], size: TemplateTextStyle["size"], weight: TemplateTextStyle["weight"], italic = false): TemplateTextStyle => ({ font, size, weight, italic });

/** The section order of each layout, after the hero (docs/design/storefront-templates.md, section 5). */
const LAYOUT_SECTIONS: Record<Layout, { id: Template["sections"][number]["id"]; variant: string }[]> = {
  vitrine: [
    { id: "services", variant: "grid" },
    { id: "gallery", variant: "grid" },
    { id: "team", variant: "default" },
    { id: "hours", variant: "default" },
    { id: "zones", variant: "default" },
    { id: "trust", variant: "default" },
  ],
  carte: [
    { id: "services", variant: "list" },
    { id: "hours", variant: "default" },
    { id: "team", variant: "default" },
    { id: "trust", variant: "default" },
    { id: "gallery", variant: "grid" },
  ],
  histoire: [
    { id: "trust", variant: "story" },
    { id: "gallery", variant: "taped" },
    { id: "services", variant: "grid" },
    { id: "hours", variant: "default" },
    { id: "team", variant: "default" },
    { id: "zones", variant: "default" },
  ],
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
