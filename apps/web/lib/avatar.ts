/** The default avatars a person can pick: Akinaza's six tones. The profile keeps the tone as its `avatarSeed`. */
export const AVATAR_TONES = [1, 2, 3, 4, 5, 6] as const;

type Tone = (typeof AVATAR_TONES)[number];

const isTone = (value: number): value is Tone => (AVATAR_TONES as readonly number[]).includes(value);

/** The avatar to draw for an account: the tone it chose, else one derived from its id (the same one everywhere). */
export function avatarOf(account: { id: string; avatarSeed?: string | null }) {
  const chosen = Number(account.avatarSeed);
  return isTone(chosen) ? ({ brand: "akinaza", tone: chosen } as const) : ({ brand: "akinaza", seed: account.id } as const);
}

/** The id of the picker's option that is in force: the chosen tone, else the first (what the account shows is derived, the picker needs a value). */
export function avatarChoice(account: { avatarSeed?: string | null }): string {
  const chosen = Number(account.avatarSeed);
  return String(isTone(chosen) ? chosen : AVATAR_TONES[0]);
}
