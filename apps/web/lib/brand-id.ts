/**
 * The id the shared libraries (`@krizaka/org`, `@krizaka/ui`, `@krizaka/tokens`) still know this product by, until their major
 * release with the commercial ids (krizaka-internal#2659): then it is `folioviv` and this module goes. Never rendered. A module of
 * its own, without imports, so a client component reads it without pulling the org registry into the browser.
 */
export const BRAND_ID = "akinaza";
