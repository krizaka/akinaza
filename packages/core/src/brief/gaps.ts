import { recommendation } from "@krizaka/brief";
import { differenceInCalendarDays, parseISO } from "date-fns";

import { applyRate } from "../money";
import { weekdayOf } from "../service-shop";
import { BRIEF_KIND, SHOP_ACTION } from "./kinds";
import type { BriefContext } from "./snapshot";

export interface InviteAction {
  kind: typeof SHOP_ACTION.invite;
  payload: { clientIds: string[]; days: string[] };
}

/** The most frequent value (ties: the smallest), or null. */
function mode(values: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  for (const [v, n] of counts) if (best === null || n > (counts.get(best) ?? 0) || (n === counts.get(best) && v < best)) best = v;
  return best;
}

/**
 * Free time in the coming days, what it would bring at the shop's own rate, and the regulars to invite: clients with
 * enough visits, none for a while, an e-mail and a granted marketing consent — those who usually come on a free day first.
 */
export function gaps({ snapshot, rules }: BriefContext) {
  const { done, ahead, clients, today, week } = snapshot;
  if (done.length < rules.minDoneVisits) return [];
  const freeDays = ahead.map((d) => ({ ...d, free: Math.max(0, d.openMinutes - d.bookedMinutes) })).filter((d) => d.free > 0);
  const freeMinutes = freeDays.reduce((s, d) => s + d.free, 0);
  if (freeMinutes < rules.minFreeMinutes) return [];

  const price = new Map(snapshot.services.map((s) => [s.id, s.priceCents]));
  const doneMinutes = done.reduce((s, v) => s + v.minutes, 0);
  const doneCents = done.reduce((s, v) => s + (price.get(v.serviceId) ?? 0), 0);
  if (doneMinutes === 0 || doneCents === 0) return [];
  const missedCents = applyRate(doneCents, { numerator: freeMinutes, denominator: doneMinutes });
  const typicalVisit = mode(done.map((v) => v.minutes)) ?? 60;

  const reachable = new Set(clients.filter((c) => c.contactable && c.marketing && !c.erased).map((c) => c.id));
  const visits = new Map<string, string[]>();
  for (const v of done) if (v.clientId && reachable.has(v.clientId)) visits.set(v.clientId, [...(visits.get(v.clientId) ?? []), v.day]);
  const freeWeekdays = new Set(freeDays.map((d) => weekdayOf(d.day)));
  const invitees = [...visits]
    .map(([id, days]) => ({ id, count: days.length, last: [...days].sort().at(-1)!, usual: mode(days.map(weekdayOf)) }))
    .filter((c) => c.count >= rules.regularMinVisits && differenceInCalendarDays(parseISO(today), parseISO(c.last)) >= rules.dormantDays)
    .sort((a, b) => Number(freeWeekdays.has(b.usual ?? -1)) - Number(freeWeekdays.has(a.usual ?? -1)) || b.count - a.count || (a.id < b.id ? -1 : 1))
    .slice(0, rules.maxInvitees);
  if (invitees.length === 0) return [];

  const action: InviteAction = { kind: SHOP_ACTION.invite, payload: { clientIds: invitees.map((c) => c.id), days: freeDays.map((d) => d.day) } };
  return [
    recommendation({
      week,
      kind: BRIEF_KIND.gaps,
      subject: "ahead",
      urgency: "now",
      impactCents: missedCents,
      figures: { freeMinutes, freeSlots: Math.floor(freeMinutes / typicalVisit), freeDays: freeDays.length, missedCents, invitees: invitees.length, dormantDays: rules.dormantDays },
      assumptions: ["atAverageRate"],
      evidence: invitees.map((c) => `client:${c.id}`),
      action,
    }),
  ];
}
