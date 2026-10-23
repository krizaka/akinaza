import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TEMPLATES, templatesFor } from "@akinaza/core";
import { describe, expect, it, vi } from "vitest";

import type { TemplateChoices } from "@/lib/template-choices";
import { renderIn } from "@/lib/test-i18n";
import en from "@/messages/en.json";

import { TemplatePicker } from "./TemplatePicker";
import { TemplatePreview } from "./TemplatePreview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app/s1/shop", useSearchParams: () => new URLSearchParams() }));

const data = (over: Partial<TemplateChoices> = {}): TemplateChoices => ({ shopType: "salon", choices: templatesFor("salon"), preselected: "salon-carte", current: null, updateAvailable: null, sectionsCustom: false, ...over });
const render = (d: TemplateChoices, locale: "en" | "fr" = "en") => renderIn(locale, "professional", <TemplatePicker data={d} shopId="s1" />);
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
/** Whether the tile that names `name` is the chosen one of the radio group. */
const checked = (html: string, name: string) => html.split("aria-checked=").find((seg) => seg.includes(`>${name}<`))?.startsWith('"true"');
const labels = Object.fromEntries(Object.entries(en.console.shopSetup.layout.sections));

describe("« Page template » inside « Look » (#261, step 4)", () => {
  it("offers the trade's templates as tiles — name, intention, layout — with the administrator's default suggested and chosen, and one action", () => {
    const html = render(data());
    const t = text(html);
    expect(html).toContain('aria-label="Templates for your trade"');
    for (const word of ["Page template", "Salon", "Light, airy, mirrors and plants.", "By appointment", "The menu of cuts and colour, booking first.", "Showcase", "Menu", "Suggested", "Use this template"]) expect(t).toContain(word);
    expect(checked(html, "By appointment")).toBe(true);
    expect(checked(html, "Salon")).toBe(false);
    expect(t).not.toContain("Your template");
    expect(t).not.toContain("Pet care");
  });

  it("marks and chooses the template the shop applied, and offers no action for it", () => {
    const html = render(data({ current: { id: "salon-vitrine", version: 1 } }));
    expect(checked(html, "Salon")).toBe(true);
    expect(text(html)).toContain("Your template");
    expect(text(html)).toContain("This is your page's template.");
    expect(text(html)).not.toContain("Suggested");
    expect(text(html)).not.toContain("Use this template");
  });

  it("asks a customised page whether to keep its order, in two buttons, never silently", () => {
    const t = text(render(data({ sectionsCustom: true })));
    expect(t).toContain("Your page has its own section order. Say whether to keep it.");
    expect(t).toContain("Use it, keep my order");
    expect(t).toContain("Use it with its order");
    expect(t).not.toContain("Use this template");
  });

  it("speaks French, and says when nothing is offered", () => {
    const t = text(render(data(), "fr"));
    for (const word of ["Modèle de page", "Suggéré", "Utiliser ce modèle", "Vitrine", "Carte"]) expect(t).toContain(word);
    expect(text(render(data({ choices: [], preselected: null })))).toContain("No template is offered for your trade yet.");
  });
});

describe("the preview of a template (#261, step 4)", () => {
  it("draws every template of the catalogue: its sections in its order, its hue when it has one, decorative", () => {
    for (const template of TEMPLATES) {
      const html = renderIn("en", "professional", <TemplatePreview template={template} labels={labels} />);
      const t = text(html);
      const positions = template.sections.filter((s) => s.visible).map((s) => t.indexOf(labels[s.id as keyof typeof labels]!));
      expect(positions.every((p) => p >= 0), template.id).toBe(true);
      expect([...positions].sort((a, b) => a - b), template.id).toEqual(positions);
      expect(html.includes("data-hue="), template.id).toBe(template.hue !== "brand-akinaza");
      expect(html).toContain(`data-paper="${template.paper}"`);
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it("draws today's plain page without a template: the story right before the photos, no hue", () => {
    const t = text(renderIn("en", "professional", <TemplatePreview template={null} labels={labels} />));
    expect(t.indexOf("Story, contact and policies")).toBeLessThan(t.indexOf("Photo gallery"));
    expect(t.indexOf("Services")).toBeLessThan(t.indexOf("Story, contact and policies"));
    expect(renderIn("en", "professional", <TemplatePreview template={null} labels={labels} />)).not.toContain("data-hue=");
  });
});

describe("« Update available » (#261, step 5)", () => {
  const two = { ...TEMPLATES.find((t) => t.id === "salon-vitrine")!, version: 2 };
  const choices = templatesFor("salon").map((t) => (t.id === "salon-vitrine" ? two : t));
  const outdated = (over: Partial<TemplateChoices> = {}) => data({ choices, current: { id: "salon-vitrine", version: 1 }, updateAvailable: { version: 2 }, ...over });

  it("marks the applied tile, chooses it, explains and offers the update — the shop keeps its version until then", () => {
    const html = render(outdated());
    const t = text(html);
    expect(checked(html, "Salon")).toBe(true);
    expect(t).toContain("Update available");
    expect(t).not.toContain("Your template");
    expect(t).toContain("Version 2 of this template is out: a new look, the same content.");
    expect(t).toContain("Update to version 2");
    expect(t).not.toContain("Use this template");
    expect(t).not.toContain("This is your page's template.");
  });

  it("asks a customised page about its order before updating, and speaks French", () => {
    const t = text(render(outdated({ sectionsCustom: true })));
    expect(t).toContain("Update, keep my order");
    expect(t).toContain("Update with its order");
    const f = text(render(outdated(), "fr"));
    expect(f).toContain("Mise à jour offerte");
    expect(f).toContain("Mettre à jour vers la version 2");
  });

  it("on the latest version nothing is offered but the word that it is the page's template", () => {
    const t = text(render(data({ choices, current: { id: "salon-vitrine", version: 2 } })));
    expect(t).toContain("Your template");
    expect(t).toContain("This is your page's template.");
    expect(t).not.toContain("Update");
  });
});

describe("the picker's tiles are dressed (#261, step 4)", () => {
  it("the grid wears @krizaka/ui's story classes, whose stylesheet the locale layout loads", () => {
    const grid = readFileSync(join(process.cwd(), "node_modules/@krizaka/ui/dist/choice-grid.js"), "utf8");
    expect(grid).toContain("kzs-choice-grid");
    expect(readFileSync(join(process.cwd(), "node_modules/@krizaka/ui/dist/story.css"), "utf8")).toContain(".kzs-choice-grid");
    expect(readFileSync(join(process.cwd(), "app/[locale]/layout.tsx"), "utf8")).toMatch(/import "@krizaka\/ui\/story\.css";/);
  });
});
