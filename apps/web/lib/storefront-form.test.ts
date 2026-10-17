import { describe, expect, it } from "vitest";

import { galleryText, joinLines, keepExtras, parseGallery, splitLines } from "./storefront-form";

describe("the owner's storefront form", () => {
  it("turns a textarea into short lines — trimmed, no blank, at most the limit", () => {
    expect(splitLines("  Fresh water \n\n A photo after\r\nThird", 2)).toEqual(["Fresh water", "A photo after"]);
    expect(splitLines("", 6)).toEqual([]);
    expect(joinLines(["a", "b"])).toBe("a\nb");
  });

  it("reads the gallery, one picture per line: address | alt (fr) | alt (en) | caption (fr) | caption (en)", () => {
    const text = "https://cdn.test/a.jpg | Le quartier | The neighbourhood | Le quartier | The area\nhttps://cdn.test/b.jpg | Un chien |  A dog";
    expect(parseGallery(text)).toEqual([
      { url: "https://cdn.test/a.jpg", altFr: "Le quartier", altEn: "The neighbourhood", captionFr: "Le quartier", captionEn: "The area" },
      { url: "https://cdn.test/b.jpg", altFr: "Un chien", altEn: "A dog" },
    ]);
  });

  it("keeps only what is an https address on its own — the server refuses the rest anyway", () => {
    expect(parseGallery("not a line\nhttp://x.test/a.jpg | a")).toEqual([{ url: "not a line", altFr: "", altEn: "" }, { url: "http://x.test/a.jpg", altFr: "a", altEn: "" }]);
  });

  it("writes a gallery back as the same lines (round trip), skipping the loops' extra files", () => {
    const items = [{ url: "https://cdn.test/a.jpg", altFr: "A", altEn: "B", captionFr: "C", captionEn: "D" }, { url: "https://cdn.test/b.jpg", altFr: "", altEn: "" }];
    expect(parseGallery(galleryText(items))).toEqual([{ url: "https://cdn.test/a.jpg", altFr: "A", altEn: "B", captionFr: "C", captionEn: "D" }, { url: "https://cdn.test/b.jpg", altFr: "", altEn: "" }]);
  });

  it("does not lose a clip's files or a wide picture's shape when the owner edits only the words", () => {
    const before = [{ url: "https://cdn.test/a.jpg", altFr: "", altEn: "", webmUrl: "https://cdn.test/a.webm", mp4Url: "https://cdn.test/a.mp4", wide: true }];
    const sent = keepExtras(parseGallery("https://cdn.test/a.jpg | Nouveau texte\nhttps://cdn.test/new.jpg"), before);
    expect(sent[0]).toMatchObject({ url: "https://cdn.test/a.jpg", altFr: "Nouveau texte", webmUrl: "https://cdn.test/a.webm", mp4Url: "https://cdn.test/a.mp4", wide: true });
    expect(sent[1]).toEqual({ url: "https://cdn.test/new.jpg", altFr: "", altEn: "" });
  });
});
