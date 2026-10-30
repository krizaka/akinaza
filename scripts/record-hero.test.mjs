import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { filesOf, PHONE, SCALE, WORDS } from "./record-hero.mjs";

const source = readFileSync(new URL("./record-hero.mjs", import.meta.url), "utf8");

describe("record-hero (the home's take and stills, as Éric)", () => {
  it("names the files of a language the way lib/tour.ts and the CDN folder read them", () => {
    expect(filesOf("fr")).toEqual({
      mp4: "hero-fr.mp4",
      webm: "hero-fr.webm",
      poster: "phone-hero-fr.jpg",
      stills: { book: "phone-book-fr.jpg", invoice: "phone-invoice-fr.jpg", books: "phone-books-fr.jpg" },
    });
  });

  it("shoots at the stills' size, 780 x 1688", () => {
    expect([PHONE.width * SCALE, PHONE.height * SCALE]).toEqual([780, 1688]);
  });

  it("waits for the same four words in both languages before a scene is shot", () => {
    expect(Object.keys(WORDS.fr)).toEqual(Object.keys(WORDS.en));
  });

  it("records the persona, never the administrator, with its password in the environment only", () => {
    expect(source).toMatch(/need\("E2E_ERIC_PASSWORD"\)/);
    expect(source).not.toMatch(/E2E_ADMIN|mira/i);
    expect(source).not.toMatch(/password:\s*["'`][^"'`]{6,}["'`]/i);
  });

  it("captures with the DevTools screencast and holds itself to 25 fps while the page moves", () => {
    expect(source).toContain("Page.startScreencast");
    expect(source).toMatch(/activeFps >= 25/);
    expect(source).toContain("fps=30");
  });

  it("only reads: Éric signs in and looks, nothing is booked, sent or filed", () => {
    expect(source).not.toMatch(/\.click\(|\.fill\(|method: "(PUT|DELETE|PATCH)"/);
  });
});
