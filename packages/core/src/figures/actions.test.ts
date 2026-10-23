import { describe, expect, it } from "vitest";

import { nextActions } from "./actions";
import { actionsInput } from "./fixtures";
import { ACTION_KIND, ACTION_KINDS, DEFAULT_FIGURE_THRESHOLDS } from "./thresholds";

const T = DEFAULT_FIGURE_THRESHOLDS;
const SLOTS = [
  { weekday: 2, startsAt: "10:00", offered: 8, booked: 1 },
  { weekday: 3, startsAt: "10:00", offered: 8, booked: 7 },
];

describe("« que faire maintenant »: ranked actions from real data only", () => {
  it("offers nothing to an empty shop: no invented advice", () => {
    expect(nextActions(actionsInput({}, { invoices: [], payments: [], expenses: [], appointments: [] }), T, ACTION_KINDS)).toEqual([]);
  });

  it("chases the largest overdue invoice, with why, target and proof", () => {
    const [a] = nextActions(actionsInput(), T, ACTION_KINDS);
    expect(a).toMatchObject({ kind: ACTION_KIND.chase, urgency: "now", impactCents: 6_498, target: { route: "invoice", invoiceId: "inv-a" }, evidence: ["inv-a"] });
    expect(a!.why).toEqual({ number: "F-0001", days: 13, amountCents: 6_498, others: 0, totalCents: 6_498 });
  });

  it("picks the biggest balance when several are overdue and counts the others", () => {
    const f = actionsInput();
    f.figures.invoices.push({ id: "inv-big", number: "F-0009", issuedOn: "2026-09-01", dueOn: "2026-09-30", subtotalCents: 50_000, gstCents: 2_500, qstCents: 4_988, totalCents: 57_488, paidCents: 0, isCredit: false, superseded: false });
    const [a] = nextActions(f, T, ACTION_KINDS);
    expect(a!.target).toEqual({ route: "invoice", invoiceId: "inv-big" });
    expect(a!.why).toMatchObject({ others: 1, totalCents: 57_488 + 6_498 });
  });

  it("does not chase what is paid, cancelled, a credit note, or not yet due", () => {
    const f = actionsInput({}, { today: "2026-10-05" });
    expect(nextActions(f, T, [ACTION_KIND.chase])).toEqual([]); // inv-a is due on 10-10, still on time
  });

  it("prepares the return (never files it) when the period ends soon, and not when it is far or already prepared", () => {
    const soon = actionsInput({}, { today: "2026-12-20" });
    const [a] = nextActions(soon, T, [ACTION_KIND.taxes]);
    expect(a).toMatchObject({ kind: ACTION_KIND.taxes, urgency: "soon", target: { route: "books", period: { start: "2026-10-01", end: "2026-12-31" } }, why: { daysLeft: 11 } });
    expect(nextActions(actionsInput(), T, [ACTION_KIND.taxes])).toEqual([]); // 69 days left
    expect(nextActions({ ...soon, returnPrepared: true }, T, [ACTION_KIND.taxes])).toEqual([]);
    const past = nextActions(actionsInput({}, { today: "2027-01-05" }), T, [ACTION_KIND.taxes]);
    expect(past[0]).toMatchObject({ urgency: "now", why: { daysLeft: 0 } });
  });

  it("suggests opening a slot that is often empty, and only over enough occurrences", () => {
    const [a] = nextActions(actionsInput({ slots: SLOTS }), T, [ACTION_KIND.slot]);
    expect(a).toMatchObject({ kind: ACTION_KIND.slot, urgency: "week", target: { route: "hours" }, why: { weekday: 2, startsAt: "10:00", booked: 1, offered: 8 }, evidence: ["slot:2:10:00"] });
    expect(nextActions(actionsInput({ slots: [{ weekday: 2, startsAt: "10:00", offered: 3, booked: 0 }] }), T, [ACTION_KIND.slot])).toEqual([]); // too few to say
    expect(nextActions(actionsInput({ slots: [{ weekday: 2, startsAt: "10:00", offered: 8, booked: 3 }] }), T, [ACTION_KIND.slot])).toEqual([]); // 37 % full
    expect(nextActions(actionsInput({ slots: [{ weekday: 2, startsAt: "10:00", offered: 8, booked: 2 }] }), T, [ACTION_KIND.slot])).toHaveLength(1); // exactly 25 %
  });

  it("ranks by urgency then by what is at stake, and shows at most maxActions", () => {
    const f = actionsInput({ slots: SLOTS }, { today: "2026-12-20" });
    expect(nextActions(f, T, ACTION_KINDS).map((a) => a.kind)).toEqual(["chase", "taxes", "slot"]);
    expect(nextActions(f, { ...T, maxActions: 2 }, ACTION_KINDS).map((a) => a.kind)).toEqual(["chase", "taxes"]);
    expect(nextActions(f, { ...T, maxActions: 0 }, ACTION_KINDS)).toEqual([]);
    const pastDue = actionsInput({ slots: SLOTS }, { today: "2027-01-05" });
    expect(nextActions(pastDue, T, ACTION_KINDS).map((a) => a.kind)).toEqual(["chase", "taxes", "slot"]); // both now: more money first
  });

  it("offers only the kinds the administrator switched on", () => {
    const f = actionsInput({ slots: SLOTS }, { today: "2026-12-20" });
    expect(nextActions(f, T, [ACTION_KIND.slot]).map((a) => a.kind)).toEqual(["slot"]);
    expect(nextActions(f, T, [])).toEqual([]);
  });
});
