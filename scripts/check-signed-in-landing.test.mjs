import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

import { inApp, pathOf, watchSignInLink } from "./check-signed-in-landing.mjs";

describe("the signed-in landing check (krizaka-ui#827)", () => {
  it("names the path a visitor landed on", () => {
    assert.equal(pathOf("https://www.akinaza.com/fr/app?x=1"), "/fr/app");
  });

  it("is run by CI after the build, as the seeded persona", () => {
    const ci = readFileSync(new URL("./ci-after-build.sh", import.meta.url), "utf8");
    assert.match(ci, /E2E_EMAIL="\$HYDRATION_OWNER_EMAIL" E2E_PASSWORD="\$HYDRATION_OWNER_PASSWORD" node scripts\/check-signed-in-landing\.mjs --base http:\/\/localhost:3000/);
  });

  it("watches the header from the first moment of the document", () => {
    assert.match(String(watchSignInLink), /MutationObserver/);
    assert.match(String(watchSignInLink), /DOMContentLoaded/);
  });

  it("counts the app's home and a shop's pages as the app, never a public page", () => {
    assert.ok(inApp("/fr/app", "fr"));
    assert.ok(inApp("/fr/app/ce0fa722/aujourdhui", "fr"));
    assert.ok(!inApp("/fr", "fr"));
    assert.ok(!inApp("/fr/pricing", "fr"));
    assert.ok(!inApp("/fr/application", "fr"));
  });

  it("looks for « Sign in » in the site bar only (a page's own hero can offer it, signed in or not)", () => {
    const script = readFileSync(new URL("./check-signed-in-landing.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(script, /header a\[href/);
    assert.match(script, /\[data-site-bar\] a\[href\$="\/sign-in"\]/);
  });
});
