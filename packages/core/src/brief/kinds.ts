/** The cards of the shop's brief and the actions their buttons run — one place, never a magic string. */
export const BRIEF_KIND = { gaps: "gaps", pricing: "pricing", taxes: "taxes" } as const;
export type BriefKind = (typeof BRIEF_KIND)[keyof typeof BRIEF_KIND];

export const SHOP_ACTION = { invite: "invite", price: "price", taxes: "taxes" } as const;
