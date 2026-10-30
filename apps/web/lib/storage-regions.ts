import { presetEndpoint, type ResidencyLabel, residencyLabel, S3_PRESETS } from "@krizaka/storage";

/**
 * Where the administrator can keep the files (akinaza#397, org rule « storage configured by the admin »): the S3-compatible providers of
 * `@krizaka/storage` and the regions each one offers. The country and province of a region come from the package's region table (one table for
 * every Krizaka product), so a sentence never claims Canada for a region the table does not know.
 */
export interface RegionChoice {
  /** `<preset>:<region>`, the value of the chip. */
  id: string;
  preset: "digitalocean-spaces" | "aws-s3" | "ovhcloud";
  region: string;
  endpoint: string;
  /** What the files' residency would be if this were saved. */
  residency: ResidencyLabel;
}

export const REGION_CHOICES: readonly RegionChoice[] = S3_PRESETS.flatMap((p) =>
  p.id === "generic"
    ? []
    : p.regions.map((region) => {
        const endpoint = presetEndpoint(p.id, region) ?? "";
        return { id: `${p.id}:${region}`, preset: p.id as RegionChoice["preset"], region, endpoint, residency: residencyLabel({ provider: "s3", endpoint, region }) };
      }),
);

/** The Canadian regions (Toronto, Montréal, Calgary, Beauharnois), then the rest, in the package's order. */
export const CANADIAN_CHOICES = REGION_CHOICES.filter((c) => c.residency.country === "CA");
export const OTHER_CHOICES = REGION_CHOICES.filter((c) => c.residency.country !== "CA");

const hostOf = (endpoint: string) => endpoint.replace(/^https:\/\//, "");

/** The choice a saved configuration corresponds to, or null (another provider, a custom endpoint). */
export function choiceOf(settings: { provider: string; endpoint: string; region: string }): RegionChoice | null {
  return REGION_CHOICES.find((c) => settings.provider === "s3" && c.region === settings.region && hostOf(c.endpoint) === hostOf(settings.endpoint)) ?? null;
}

/** The residency of whatever is saved (any provider), in the keys the messages speak: `console.admin.storage.residency.<key>`. */
export function residencyOfSaved(settings: { provider: string; endpoint: string; region: string }): ResidencyLabel["key"] {
  if (settings.provider === "local") return "device";
  return residencyLabel({ provider: settings.provider === "s3" ? "s3" : "http", endpoint: settings.endpoint, region: settings.region }).key;
}

/** The settings a choice sets (the access keys stay in the environment). */
export const settingsOf = (choice: RegionChoice): Record<"storage.provider" | "storage.endpoint" | "storage.region", string> => ({
  "storage.provider": "s3",
  "storage.endpoint": choice.endpoint,
  "storage.region": choice.region,
});
