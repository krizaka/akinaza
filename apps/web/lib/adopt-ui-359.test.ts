import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", "messages"].includes(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx") ? [path] : [];
  });
const all = sources(root).map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("Krizaka UI 3.59 adopted (akinaza#337, #352): no local copy of a block", () => {
  it("leaves no TODO or note that waits for krizaka-ui#627, #690 or #657", () => {
    const waiting = all.filter(({ text }) => /(TODO|Remove|remove|until)[^\n]*krizaka-ui#(627|690|657)/.test(text)).map(({ path }) => path);
    expect(waiting).toEqual([]);
  });

  it("draws tags, markers, saved views and the selection bar only with the package", () => {
    const organize = all.find(({ path }) => path.endsWith("components/app/organize.tsx"))!.text;
    for (const piece of ["TagChip", "MarkerPicker", "SavedViews", "TagSelector"]) expect(organize).toContain(piece);
    expect(organize).not.toContain("data-tag-marker");
    expect(all.some(({ text }) => text.includes("data-tag-marker") || text.includes("--kz-tag-"))).toBe(false);
    // The selection bar is DataTable's `bulkActions`: no hand-made region for it.
    for (const file of ["ClientsCatalogue.tsx", "InvoicesTable.tsx"]) {
      const text = all.find(({ path }) => path.endsWith(file))!.text;
      expect(text).toContain("bulkActions");
      expect(text).not.toContain('role="region"');
    }
  });

  it("sets the admin's tag and status sets with the package's editors", () => {
    const text = all.find(({ path }) => path.endsWith("components/admin/OrganizeConfig.tsx"))!.text;
    expect(text).toContain("@krizaka/ui/kind-config-editor");
    expect(text).toContain("TagSetEditor");
    expect(text).toContain("StatusSetEditor");
  });

  it("offers the product register's themes with the package's Appearance block, never the Cahier papers", () => {
    const text = all.find(({ path }) => path.endsWith("components/account/PreferencesSettings.tsx"))!.text;
    expect(text).toContain("AppearanceSettings");
    expect(text).toContain("useAppearance");
    expect(text).not.toMatch(/seyes|kraft|washi/i);
  });

  it("books with the package's SlotPicker, not a list of buttons of its own", () => {
    const text = all.find(({ path }) => path.endsWith("components/app/BookingFlow.tsx"))!.text;
    expect(text).toContain("@krizaka/ui/slot-picker");
    expect(text).not.toContain('role="radiogroup"');
  });
});
