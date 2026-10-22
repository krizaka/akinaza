import { composeBrief, type Guard, type Recommendation } from "@krizaka/brief";

import { gaps, type InviteAction } from "./gaps";
import { type BriefKind, SHOP_ACTION } from "./kinds";
import { type PriceAction, pricing } from "./pricing";
import { type BriefContext, type BriefRules, type BriefSnapshot, DEFAULT_BRIEF_RULES } from "./snapshot";
import { type LedgerAction, taxProvision } from "./taxes";

export { gaps, type InviteAction } from "./gaps";
export { BRIEF_KIND, type BriefKind, SHOP_ACTION } from "./kinds";
export { type PriceAction, pricing } from "./pricing";
export { type BriefContext, type BriefRules, type BriefSnapshot, DEFAULT_BRIEF_RULES } from "./snapshot";
export { type LedgerAction, taxProvision } from "./taxes";

export type ShopAction = InviteAction | PriceAction | LedgerAction;
export type ShopRecommendation = Recommendation<BriefKind, ShopAction>;

/**
 * The falcon: an invitation goes only to clients the shop may write to — an e-mail, the latest marketing consent granted,
 * not erased (Loi 25, CASL). The detector already filters; this checks again, so a change there cannot slip through.
 */
export const marketingConsent: Guard<BriefContext, ShopRecommendation> = {
  name: "marketingConsent",
  check: (item, { snapshot }) => {
    if (item.action.kind !== SHOP_ACTION.invite) return null;
    const allowed = new Set(snapshot.clients.filter((c) => c.contactable && c.marketing && !c.erased).map((c) => c.id));
    return item.action.payload.clientIds.every((id) => allowed.has(id)) ? null : "NO_MARKETING_CONSENT";
  },
};

/** The shop's Monday brief: the three recommendations that matter most this week. */
export function shopBrief(snapshot: BriefSnapshot, rules: BriefRules = DEFAULT_BRIEF_RULES) {
  return composeBrief<BriefContext, ShopRecommendation>({
    week: snapshot.week,
    ctx: { snapshot, rules },
    detectors: [gaps, pricing, taxProvision] as ((ctx: BriefContext) => ShopRecommendation[])[],
    guards: [marketingConsent],
  });
}
