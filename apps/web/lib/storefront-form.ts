/** The text the owner types for the storefront, as the data the server takes (and back). Validation stays on the server. */

/** A textarea as short lines: trimmed, blanks dropped, at most `max`. */
export const splitLines = (text: string, max: number): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);

export const joinLines = (lines: readonly string[]): string => lines.join("\n");

export interface GalleryLine {
  url: string;
  altFr: string;
  altEn: string;
  captionFr?: string;
  captionEn?: string;
  /** What the form does not edit: kept when the same address comes back. */
  webmUrl?: string | null;
  mp4Url?: string | null;
  wide?: boolean;
}

/** One picture per line: `address | alt (fr) | alt (en) | caption (fr) | caption (en)`. */
export function parseGallery(text: string, max = 12): GalleryLine[] {
  return splitLines(text, max).map((line) => {
    const [url = "", altFr = "", altEn = "", captionFr = "", captionEn = ""] = line.split("|").map((p) => p.trim());
    return { url, altFr, altEn, ...(captionFr ? { captionFr } : {}), ...(captionEn ? { captionEn } : {}) };
  });
}

export function galleryText(items: readonly GalleryLine[]): string {
  return items.map((i) => [i.url, i.altFr, i.altEn, i.captionFr ?? "", i.captionEn ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n");
}

/** The lines the owner submitted, each given back the loop files and the shape its address already had (the form edits neither). */
export function keepExtras<T extends { url: string }>(lines: readonly T[], before: readonly GalleryLine[]): (T & Pick<GalleryLine, "webmUrl" | "mp4Url" | "wide">)[] {
  return lines.map((line) => {
    const old = before.find((b) => b.url === line.url);
    return { ...line, ...(old?.webmUrl ? { webmUrl: old.webmUrl } : {}), ...(old?.mp4Url ? { mp4Url: old.mp4Url } : {}), ...(old?.wide ? { wide: true } : {}) };
  });
}
