import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

const script = readFileSync(new URL("./e2e-composer.mjs", import.meta.url), "utf8");

describe("the composer journey waits on real conditions (the flake of #543)", () => {
  it("waits for React to take over the controls before it presses a key or picks a style", () => {
    const takeover = script.indexOf("__reactProps$");
    assert.ok(takeover > 0, "the journey must wait for the takeover of the controls");
    assert.ok(takeover < script.indexOf('keyboard.press("Alt+ArrowDown")'), "the takeover is awaited before the first key");
    assert.ok(takeover < script.indexOf("selectOption(other)"), "the takeover is awaited before the first choice");
  });

  it("waits for each action's visible effect, and never sleeps inside the journey", () => {
    assert.match(script, /the list shows the section moved down/);
    assert.match(script, /the style picker keeps the new style/);
    const journey = script.slice(script.indexOf("// 2 - reorder"));
    assert.doesNotMatch(journey, /waitForTimeout\(|sleep\(\d{4,}\)/);
  });
});
