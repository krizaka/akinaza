import { z } from "zod";

/**
 * The businesses Akinaza serves: independent Québec **service businesses** (hair and beauty salons, studios,
 * consultants, freelancers). **Restaurants, cafés, bars and bakeries with on-site consumption are excluded**: in Québec
 * they must use a sales recording system (SEV) certified MEV-WEB by Revenu Québec — Akinaza is not one. The point of sale is a stub behind a flag
 * until the SRM scope and the payment provider are decided (epic krizaka/.github#52).
 */
export const SHOP_KINDS = ["salon", "boutique", "services", "other"] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];
export const EXCLUDED_KINDS = ["restaurant", "cafe", "bar", "bakery"] as const;

/** Whether the point of sale may open for a shop: never for a restaurant, a café, a bar or a bakery, and only when the flag is on. */
export function posAllowed(kind: string, flagEnabled: boolean): boolean {
  return flagEnabled && (SHOP_KINDS as readonly string[]).includes(kind) && !(EXCLUDED_KINDS as readonly string[]).includes(kind);
}

/**
 * Loi 25 (Québec's Act respecting the protection of personal information in the private sector): consent is given per
 * purpose, in clear words of a known version, and can be withdrawn; it is never pre-ticked. The client file keeps every
 * grant and withdrawal (append-only).
 */
export const CONSENT_PURPOSES = ["service", "reminders", "marketing"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const consentSchema = z.object({ purpose: z.enum(CONSENT_PURPOSES), granted: z.boolean(), textVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export type Consent = z.infer<typeof consentSchema>;

/** The consents in force: for each purpose, the latest decision (none = not given). `service` is the file itself. */
export function consentsInForce(history: readonly (Consent & { at: Date })[]): Record<ConsentPurpose, boolean> {
  const latest = (p: ConsentPurpose) => [...history].filter((c) => c.purpose === p).sort((a, b) => b.at.getTime() - a.at.getTime())[0]?.granted ?? false;
  return { service: latest("service"), reminders: latest("reminders"), marketing: latest("marketing") };
}

/** The realtime topics: one per shop's booking slots (a slot taken disappears from every open booking page). */
export const REALTIME_CHANNEL = "akinaza_events";
export const slotsTopic = (shopId: string) => `shop:${shopId}:slots`;
/** The page of a shop changed (the wall, the reel, the board, the reviews): the open storefronts, and the studio's preview, render again. */
export const pageTopic = (shopId: string) => `shop:${shopId}:page`;
export type SlotEvent = { type: "slot"; shopId: string; staffId: string; startsAt: string; endsAt: string; status: "taken" | "freed" };
