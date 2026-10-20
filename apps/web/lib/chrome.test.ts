import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

const chrome = readFileSync(join(__dirname, "../components/SiteChrome.tsx"), "utf8");

describe("the bar's composition (NavBar of @krizaka/ui, 3.30)", () => {
  it("lets the Product menu follow the bar's own breakpoint: no inline override (inlineFrom/inlineUpTo)", () => {
    // A menu of three links is inline from lg and a dropdown below (@krizaka/ui 3.30); forcing either lands the bar past the edge.
    expect(chrome).toContain("<NavBar.Menu");
    expect(chrome).not.toMatch(/inlineUpTo/);
    expect(chrome).not.toMatch(/inlineFrom/);
  });

  it("keeps the menu to three links, the size at which it is inline from lg", () => {
    const ids = [...chrome.matchAll(/\{ id: "(\w+)", icon:/g)].map((m) => m[1]);
    expect(ids.length).toBeLessThanOrEqual(3);
    for (const messages of [en, fr]) for (const id of ids) expect(messages.chrome.menu, id).toHaveProperty(id);
  });

  it("is built from the family's pieces: the one language switch, the phone panel, no hand-made bar", () => {
    expect(chrome).toContain("NavBar.Language");
    expect(chrome).toContain("NavBar.Mobile");
    expect(chrome).not.toMatch(/NavBar\.Family|NavBar\.Badge/);
  });
});
