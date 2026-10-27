/**
 * The phone-sized widths of the demo shops' covers (akinaza#459): the hero is the LCP and a 390 px phone must not download the 1600 px file.
 * Hashed files under `site/products/akinaza/demo/` (the media CDN has no resizer), 400 / 800 / 1200 px wide, WebP. A cover with no entry here is served as it is.
 */
const CDN = "https://krizaka-assets.b-cdn.net/site/products/akinaza/demo";
const RENDITIONS: Readonly<Record<string, readonly (readonly [number, string])[]>> = {
  [`${CDN}/salon-cover.dfc17581a8.webp`]: [[400, "salon-cover-400.92e29e8689"], [800, "salon-cover-800.bc02816112"], [1200, "salon-cover-1200.16adc49df3"]],
  [`${CDN}/pets-cover.18173bdfbf.webp`]: [[400, "pets-cover-400.930edbe919"], [800, "pets-cover-800.0e117d92c2"], [1200, "pets-cover-1200.851ddaa3d7"]],
};

/** The `srcset` of a cover (`<url> 400w, …`), or undefined when it has no width variants. */
export function coverSrcSet(src: string): string | undefined {
  const set = RENDITIONS[src];
  return set?.map(([width, file]) => `${CDN}/${file}.webp ${width}w`).join(", ");
}

/** The `sizes` the hero draws its cover with: the split variant shows it in a column from 48 rem, the others full width (as @krizaka/ui/shop/hero does). */
export const coverSizes = (variant: string | undefined): string => (variant === "split" ? "(min-width: 48rem) 32rem, 100vw" : "100vw");
