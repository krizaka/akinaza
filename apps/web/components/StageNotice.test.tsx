import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StageNotice } from "./StageNotice";

const source = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("the development-version notice (akinaza#440)", () => {
  it("shows in the stage dev, in both languages", () => {
    expect(renderToStaticMarkup(<StageNotice locale="fr" stage="dev" />)).toContain("Version de développement");
    expect(renderToStaticMarkup(<StageNotice locale="en" stage="dev" />)).toContain("Development version");
  });

  it("marks itself as top chrome", () => {
    expect(renderToStaticMarkup(<StageNotice locale="en" stage="dev" />)).toContain("data-top-chrome");
  });

  it("renders nothing in production", () => {
    expect(renderToStaticMarkup(<StageNotice locale="fr" stage="prod" />)).toBe("");
    expect(renderToStaticMarkup(<StageNotice locale="en" stage="prod" />)).toBe("");
  });

  it("shows when the stage is forgotten, so a deployment that does not say it is production is seen", () => {
    expect(renderToStaticMarkup(<StageNotice locale="en" stage="" />)).toContain("Development version");
  });

  it("is mounted once, in the root layout, before the page", () => {
    const layout = source("../app/[locale]/layout.tsx");
    expect(layout).toContain("<StageNotice");
    expect(layout.indexOf("<StageNotice")).toBeLessThan(layout.indexOf("<RoutePageTransition>"));
  });

  it("is cleared by the site bar with CSS only: a zero-height sticky wrapper after it, no layout listener", () => {
    const bar = source("./SiteChrome.tsx");
    expect(bar).toMatch(/className="[^"]*\bsticky\b[^"]*\btop-0\b[^"]*\bh-0\b[^"]*" data-site-bar/);
    expect(bar).toContain('className="relative top-3"');
    expect(bar).not.toMatch(/\bfixed\b/);
    expect(source("./StageNotice.tsx")).not.toMatch(/use client|useEffect|addEventListener|ResizeObserver/);
  });
});
