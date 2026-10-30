import { ThemeScript } from "@krizaka/ui/theme";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const layout = readFileSync(join(__dirname, "../app/[locale]/layout.tsx"), "utf8");
const blocksCss = readFileSync(join(__dirname, "../node_modules/@krizaka/ui/dist/blocks.css"), "utf8");

describe("a signed-in visitor never sees the signed-out actions (krizaka-ui#827, akinaza#515)", () => {
  it("the nonce'd head script sets html[data-session] from the kz-session hint, before the first paint", () => {
    const html = renderToStaticMarkup(<ThemeScript defaultMode="dark" nonce="n0nce" />);
    expect(html).toContain('nonce="n0nce"');
    expect(html).toContain("kz-session");
    expect(html).toContain('setAttribute("data-session"');
  });

  it("the locale layout puts that script in the head with the page's nonce", () => {
    expect(layout).toMatch(/<head>\s*<ThemeScript[^>]*nonce=\{nonce\}/);
  });

  it("the blocks stylesheet hides [data-signed-out-only] under html[data-session]", () => {
    expect(blocksCss).toMatch(/html\[data-session\]\s+\[data-signed-out-only\]\s*\{\s*display:\s*none\s*!important/);
  });
});
