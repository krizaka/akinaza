import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./record-journey.mjs", import.meta.url), "utf8");

describe("record-journey (the hero's continuous take)", () => {
  it("captures with the DevTools screencast and holds itself to 25 fps while the page moves", () => {
    expect(source).toContain("Page.startScreencast");
    expect(source).toMatch(/activeFps >= 25/);
    expect(source).toContain("fps=30");
  });

  it("walks the whole journey in one page: storefront, booking, the walker's day, the report, the client, the books", () => {
    for (const beat of ['mark("storefront")', 'mark("booked")', 'mark("day")', 'mark("sent")', 'mark("client")', 'mark("books")']) expect(source).toContain(beat);
  });

  it("keeps every credential in the environment, never in the file or in the output", () => {
    expect(source).toMatch(/need\("E2E_CLIENT_PASSWORD"\)/);
    expect(source).not.toMatch(/password:\s*["'`][^"'`]{6,}["'`]/i);
    expect(source).not.toMatch(/console\.log\([^)]*password/i);
  });
});
