import { FakeConnector, isPlatform, type Platform, PLATFORMS, type SocialConnector } from "@akinaza/core";

/** `APP_SOCIAL_SYNC`: connections are off, or the in-memory fake (development and tests). */
export type SyncMode = "off" | "fake";

/**
 * The connector of a platform, or null when connections are off. Slice 1 has the in-memory fake only; the real
 * connectors (Google slice 2, Meta slice 3) are added here behind their own mode and credentials.
 */
const fakes = new Map<Platform, FakeConnector>();

export function connectorFor(platform: string, mode: SyncMode): SocialConnector | null {
  if (!isPlatform(platform) || mode !== "fake") return null;
  if (!fakes.has(platform)) fakes.set(platform, new FakeConnector(platform));
  return fakes.get(platform)!;
}

/** The platforms that can be connected in this mode. */
export const availablePlatforms = (mode: SyncMode): Platform[] => PLATFORMS.filter((p) => connectorFor(p, mode));
