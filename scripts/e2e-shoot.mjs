import path from "node:path";

// One capture helper for the e2e scripts: a screenshot of the page in both themes,
// written to `out` (nothing when no folder is given).
export function makeShoot(page, out, locale) {
  return async (name) => {
    if (!out) return;
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => {
        localStorage.setItem("kz-theme", t);
        document.documentElement.classList.toggle("light", t === "light");
      }, theme);
      await page.screenshot({ path: path.join(out, `${name}-${theme}-${locale}.png`) });
    }
  };
}
