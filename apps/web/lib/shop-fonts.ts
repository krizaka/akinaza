import localFont from "next/font/local";

/**
 * The faces a shop's first screen draws (the text sans and the product display), loaded by `next/font` instead of the plain
 * `@font-face` of `@krizaka/fonts`: preloaded with the page, `display: optional` (the face is used if it is there in time and
 * never swaps in later) and a fallback whose metrics are computed from the file. A late swap re-wrapped the hero text and moved
 * the header (CLS 0.02-0.26, akinaza#459). The files are the package's own, never copies.
 */
export const shopSans = localFont({
  src: "../node_modules/@krizaka/fonts/files/web/atkinson-hyperlegible-next-latin-wght.woff2",
  weight: "400 700",
  display: "optional",
  adjustFontFallback: "Arial",
  variable: "--kz-shop-font-sans",
});

export const shopDisplay = localFont({
  src: "../node_modules/@krizaka/fonts/files/web/plus-jakarta-sans-latin-wght.woff2",
  weight: "500 800",
  display: "optional",
  adjustFontFallback: "Arial",
  variable: "--kz-shop-font-display",
});
