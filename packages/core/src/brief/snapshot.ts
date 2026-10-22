import type { Cents } from "../money";

/**
 * What the Monday brief reads — one shop, one moment, already in the shop's local calendar (the database layer builds it;
 * nothing here reads a clock or a database). Personal data is kept to what a recommendation needs: ids and two flags.
 */
export interface BriefSnapshot {
  /** The brief's ISO week (`2026-W43`) and today's local date. */
  week: string;
  today: string;
  /** Active services. `priceVaries`: the price is « from », so no price advice. */
  services: { id: string; priceCents: Cents; durationMinutes: number; priceVaries: boolean }[];
  /** Done appointments of the look-back window (8 weeks by default), one row per visit. */
  done: { id: string; serviceId: string; clientId: string | null; day: string; minutes: number }[];
  /** The next days (7 by default): minutes open on the staff's schedules (days off removed) and minutes already booked. */
  ahead: { day: string; openMinutes: number; bookedMinutes: number }[];
  /** Clients the shop may write to: `contactable` = an e-mail on file; `marketing` = the latest marketing consent is granted. */
  clients: { id: string; contactable: boolean; marketing: boolean; erased: boolean }[];
  /** Invoices issued and expenses paid during the previous week (Monday to Sunday). */
  lastWeek: {
    invoices: { id: string; number: string; issuedOn: string; totalCents: Cents; gstCents: Cents; qstCents: Cents }[];
    expenses: { id: string; supplier: string; paidOn: string; gstCents: Cents; qstCents: Cents; businessSharePct: number }[];
  };
}

/** The thresholds of the brief — data, so a setting can change them without code. */
export interface BriefRules {
  /** Below this many done visits in the look-back window, gaps and prices are not computed (too thin to say anything). */
  minDoneVisits: number;
  /** Weeks of the look-back window (to turn its volume into a month). */
  lookBackWeeks: number;
  /** A regular: at least this many visits… */
  regularMinVisits: number;
  /** …and no visit for at least this many days. */
  dormantDays: number;
  /** At most this many invitations in one action. */
  maxInvitees: number;
  /** A gap is worth a card from this many free minutes over the coming days. */
  minFreeMinutes: number;
  /** A service is under-priced when it earns less than this share of the shop's average per minute (percent)… */
  underpricedPct: number;
  /** …and takes at least this share of the booked time (percent). */
  minTimeSharePct: number;
  /** The suggested price never rises more than this (percent). */
  maxRaisePct: number;
}

export const DEFAULT_BRIEF_RULES: BriefRules = {
  minDoneVisits: 10,
  lookBackWeeks: 8,
  regularMinVisits: 3,
  dormantDays: 42,
  maxInvitees: 20,
  minFreeMinutes: 60,
  underpricedPct: 85,
  minTimeSharePct: 15,
  maxRaisePct: 15,
};

export interface BriefContext {
  snapshot: BriefSnapshot;
  rules: BriefRules;
}
