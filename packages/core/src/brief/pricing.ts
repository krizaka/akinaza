import { recommendation } from "@krizaka/brief";

import { applyRate } from "../money";
import { BRIEF_KIND, SHOP_ACTION } from "./kinds";
import type { BriefContext } from "./snapshot";

export interface PriceAction {
  kind: typeof SHOP_ACTION.price;
  payload: { serviceId: string; currentCents: number; suggestedCents: number };
}

/** Rounds cents to the nearest dollar, half up (a price list reads in dollars). */
const toDollar = (cents: number) => applyRate(cents, { numerator: 1, denominator: 100 }) * 100;

/**
 * Revenue per hour, by service. A service that fills a large share of the booked time but earns well under the shop's
 * average per minute gets a suggested price: the one that reaches the average, rounded to the dollar, capped. The gain is
 * « at equal volume » — written on the card; it is revenue per hour, not a margin (expenses are not split by service).
 */
export function pricing({ snapshot, rules }: BriefContext) {
  const { done, services, week } = snapshot;
  if (done.length < rules.minDoneVisits) return [];
  const totalMinutes = done.reduce((s, v) => s + v.minutes, 0);
  const byId = new Map(services.map((s) => [s.id, s]));
  const totalCents = done.reduce((s, v) => s + (byId.get(v.serviceId)?.priceCents ?? 0), 0);
  if (totalMinutes === 0 || totalCents === 0) return [];

  return services.flatMap((service) => {
    if (service.priceVaries) return [];
    const visits = done.filter((v) => v.serviceId === service.id);
    const minutes = visits.reduce((s, v) => s + v.minutes, 0);
    if (visits.length === 0 || minutes * 100 < totalMinutes * rules.minTimeSharePct) return [];
    const cents = visits.length * service.priceCents;
    // cents / minutes < underpriced% × totalCents / totalMinutes, in integers.
    if (cents * totalMinutes * 100 >= rules.underpricedPct * totalCents * minutes) return [];

    const reachesAverage = applyRate(totalCents, { numerator: service.durationMinutes, denominator: totalMinutes });
    const cap = applyRate(service.priceCents, { numerator: 100 + rules.maxRaisePct, denominator: 100 });
    const suggestedCents = Math.min(toDollar(reachesAverage), Math.floor(cap / 100) * 100);
    const raiseCents = suggestedCents - service.priceCents;
    if (raiseCents < 100) return [];
    // The look-back's volume brought to a month: weeks × 12 / 52.
    const monthlyGainCents = applyRate(raiseCents * visits.length, { numerator: 52, denominator: rules.lookBackWeeks * 12 });
    const action: PriceAction = { kind: SHOP_ACTION.price, payload: { serviceId: service.id, currentCents: service.priceCents, suggestedCents } };
    return [
      recommendation({
        week,
        kind: BRIEF_KIND.pricing,
        subject: service.id,
        urgency: "week",
        impactCents: monthlyGainCents,
        figures: {
          timeSharePct: Math.round((minutes * 100) / totalMinutes),
          revenueSharePct: Math.round((cents * 100) / totalCents),
          currentCents: service.priceCents,
          suggestedCents,
          raiseCents,
          monthlyGainCents,
        },
        assumptions: ["equalVolume", "revenueNotMargin"],
        evidence: visits.map((v) => `appointment:${v.id}`),
        action,
      }),
    ];
  });
}
