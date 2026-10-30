import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { composerLayoutProblems } from "./composer-layout.mjs";

const b = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
const fine = {
  viewport: { width: 1440, height: 900 },
  preview: b(300, 100, 1100, 800),
  radios: [{ name: "Cahier", card: b(20, 200, 140, 260), content: [b(28, 208, 120, 252)], check: [b(116, 206, 136, 226)] }],
};

describe("the composer's layout guard (krizaka-internal#214)", () => {
  it("accepts a preview of half the screen and a radio whose content sits inside its card, clear of the check", () => {
    const clear = { ...fine, radios: [{ ...fine.radios[0], content: [b(28, 208, 100, 252)] }] };
    assert.deepEqual(composerLayoutProblems(clear), []);
  });
  it("refuses the phone-width preview squeezed between three panels (400 of 1440 px)", () => {
    const squeezed = { ...fine, preview: b(620, 100, 1020, 800) };
    assert.match(composerLayoutProblems(squeezed)[0], /400 px wide, 28 % of the 1440 px screen/);
  });
  it("refuses a radio with a box outside its card, or its check over its own content", () => {
    const out = { ...fine, radios: [{ ...fine.radios[0], content: [b(28, 208, 160, 252)] }] };
    assert.match(composerLayoutProblems(out).join("|"), /outside its card/);
    assert.match(composerLayoutProblems(fine).join("|"), /check over its own content/);
  });
  it("refuses a page with no desktop preview", () => {
    assert.deepEqual(composerLayoutProblems({ ...fine, preview: null }), ["the desktop preview is not drawn"]);
  });
});
