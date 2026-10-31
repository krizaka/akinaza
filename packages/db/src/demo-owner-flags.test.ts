import { describe, expect, it } from "vitest";

import { ALL_DEMO_SHOPS, DEMO_OWNER_FLAGS, demoOwnerFlagArgs } from "./demo-shops";

describe("the demo owners' switches (local = deployed)", () => {
  it("every demo shop's owner gets the notebook storefront, once, through set-setting --user", () => {
    const owners = [...new Set(ALL_DEMO_SHOPS.map((d) => d.ownerEmail))];
    expect(owners.length).toBeGreaterThanOrEqual(3);
    const args = demoOwnerFlagArgs();
    expect(args).toHaveLength(owners.length * Object.keys(DEMO_OWNER_FLAGS).length);
    for (const email of owners) expect(args).toContainEqual(["features.cahierStorefront", "true", "--user", email, "--actor", "seed-demo-flags"]);
  });
  it("only the seed's own .test addresses are ever switched", () => {
    for (const a of demoOwnerFlagArgs()) expect(a[3]).toMatch(/@akinaza\.test$/);
  });
});
