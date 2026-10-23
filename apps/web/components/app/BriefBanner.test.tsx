import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BriefBanner } from "./BriefBanner";

vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say: (key: string, vars?: Record<string, string | number>) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key), locale: "fr" }) }));

describe("« Le point du lundi » on Today (docs/ux/2026-10-full-review.md B2)", () => {
  it("says nothing when the brief has nothing to say: the day comes first", () => {
    expect(renderToStaticMarkup(<BriefBanner count={0} href="/fr/app/s-1/brief" />)).toBe("");
  });

  it("announces the facts in one line with the way to the full point and a way to put it aside", () => {
    const html = renderToStaticMarkup(<BriefBanner count={2} href="/fr/app/s-1/brief" />);
    expect(html).toContain('data-testid="brief-banner"');
    expect(html).toContain("brief.title");
    expect(html).toContain("brief.lead");
    expect(html).toMatch(/href="\/fr\/app\/s-1\/brief"[^>]*>today\.brief\.see 2</);
    expect(html).toContain('aria-label="today.brief.dismiss"');
  });
});
