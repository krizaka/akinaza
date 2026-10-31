import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { CANADIAN_CHOICES, choiceOf, OTHER_CHOICES, REGION_CHOICES, residencyOfSaved, settingsOf } from "./storage-regions";

const KEYS = ["canada-qc", "canada-on", "canada-ab", "canada", "elsewhere", "unknown", "user-cloud", "device"] as const;

describe("where the administrator keeps the files (akinaza#397)", () => {
  it("offers Toronto, and says Ontario for it", () => {
    const toronto = REGION_CHOICES.find((c) => c.id === "digitalocean-spaces:tor1")!;
    expect(CANADIAN_CHOICES).toContain(toronto);
    expect(toronto.residency).toMatchObject({ key: "canada-on", country: "CA", province: "ON" });
    expect(toronto.endpoint).toBe("https://tor1.digitaloceanspaces.com");
    expect(settingsOf(toronto)).toEqual({ "storage.provider": "s3", "storage.endpoint": "https://tor1.digitaloceanspaces.com", "storage.region": "tor1" });
  });

  it("never claims Canada for a region outside it, nor for a contradicting endpoint, nor for a Bunny-shaped zone", () => {
    for (const c of OTHER_CHOICES) {
      expect(c.residency.key, c.id).toBe("elsewhere");
    }
    expect(residencyOfSaved({ provider: "s3", endpoint: "nyc3.digitaloceanspaces.com", region: "tor1" })).toBe("elsewhere");
    expect(residencyOfSaved({ provider: "http", endpoint: "storage.bunnycdn.com", region: "" })).toBe("elsewhere");
    expect(residencyOfSaved({ provider: "local", endpoint: "", region: "" })).toBe("device");
  });

  it("finds the choice a saved configuration is", () => {
    expect(choiceOf({ provider: "s3", endpoint: "tor1.digitaloceanspaces.com", region: "tor1" })?.id).toBe("digitalocean-spaces:tor1");
    expect(choiceOf({ provider: "http", endpoint: "storage.bunnycdn.com", region: "" })).toBeNull();
  });

  it("says every residency in both languages", () => {
    for (const messages of [en, fr]) {
      for (const key of KEYS) expect((messages.console.admin.storage.residency as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
