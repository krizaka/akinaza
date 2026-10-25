import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "vitest";

import { WORKSPACES, workspacesWithSources } from "./deps.mjs";

describe("dependency-cruiser covers every workspace (akinaza#320)", () => {
  it("lists every workspace that owns a tsconfig: a new one cannot escape the cruise", () => {
    assert.deepEqual(Object.keys(WORKSPACES).sort(), workspacesWithSources().sort());
  });

  it("each workspace records its known violations beside it (they only shrink)", () => {
    for (const workspace of Object.keys(WORKSPACES)) {
      assert.ok(existsSync(new URL(`../${workspace}/.dependency-cruiser-known-violations.json`, import.meta.url)), workspace);
    }
  });
});
