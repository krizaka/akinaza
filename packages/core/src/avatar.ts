import { defaultFor, defaultUrl, listDefaults, type OrgDefaultItem } from "@krizaka/org";

/**
 * Akinaza's people wear the Krizaka org JSON's default pictures (`@krizaka/org` `defaults.person`, ADR-011/014, akinaza#499): never a URL written
 * here, never the old gradient silhouette. The profile keeps the picture the person chose as `avatarSeed` (the id of a `person` item); a person
 * who chose nothing gets `defaultFor("person", id)`, deterministic, so they look the same on every screen and in every app.
 */

/** The old six tones (`avatarSeed` "1".."6") are the org set's `silhouette-<n>` items. */
const LEGACY_TONE = /^[1-6]$/;

const people = (): readonly OrgDefaultItem[] => listDefaults("person");

/** The item the person chose, or null (nothing chosen, or an id the set no longer has). */
export function chosenPicture(avatarSeed: string | null | undefined): OrgDefaultItem | null {
  if (!avatarSeed) return null;
  const id = LEGACY_TONE.test(avatarSeed) ? `silhouette-${avatarSeed}` : avatarSeed;
  return people().find((item) => item.id === id) ?? null;
}

/** The picture to draw for a person: the one they chose, else the one their id assigns. Null only when the set is empty. */
export function pictureOf(who: { id: string; avatarSeed?: string | null }): OrgDefaultItem | null {
  return chosenPicture(who.avatarSeed) ?? defaultFor("person", who.id) ?? null;
}

/** The address of that picture (256 px suits every avatar size up to 2x of `lg`). */
export function avatarSrc(who: { id: string; avatarSeed?: string | null }, size = 256): string | undefined {
  const item = pictureOf(who);
  return item ? defaultUrl(item, size) : undefined;
}

/** What `Avatar` takes for a person without a photo: the org picture as the fallback, the initial while it loads. */
export function avatarOf(who: { id: string; avatarSeed?: string | null }, size = 256): { fallbackSrc?: string } {
  const src = avatarSrc(who, size);
  return src ? { fallbackSrc: src } : {};
}

/** The id of the picker's option that is in force: the chosen picture, else "" (no option is checked while the picture is the assigned one). */
export function avatarChoice(account: { avatarSeed?: string | null }): string {
  return chosenPicture(account.avatarSeed)?.id ?? "";
}

/** The picker's options: every `person` picture of the set, labelled by its own alt text. */
export function avatarOptions(locale: "en" | "fr"): { id: string; label: string; src: string }[] {
  return people().map((item) => ({ id: item.id, label: item.alt[locale], src: defaultUrl(item, 256) }));
}
