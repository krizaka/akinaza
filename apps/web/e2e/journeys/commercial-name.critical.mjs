// Journey: the commercial name (krizaka-internal#2039, #2103). A visitor of the home and of the sign-in page reads « Folioviv »
// in the tab title and in the page, and never the code name. The expected name comes from @krizaka/org, not from a literal.
import { brandOf, findCodeNames } from "@krizaka/org";
import { expect, test } from "@playwright/test";

const NAME = brandOf("akinaza").commercialName;

for (const path of ["/fr", "/en", "/fr/sign-in"]) {
  test(`commercial name: ${path} says ${NAME} in the title and the page, no code name`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(new RegExp(NAME));
    await expect(page.locator("header, nav, main").first()).toContainText(NAME);
    const visible = (await page.locator("body").innerText()) ?? "";
    expect(findCodeNames(visible), "no code name in the text a visitor reads").toEqual([]);
  });
}
