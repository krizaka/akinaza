import { recommendation } from "@krizaka/brief";

import { balance, expenseEntries, invoiceEntries } from "../ledger";
import { BRIEF_KIND, SHOP_ACTION } from "./kinds";
import type { BriefContext } from "./snapshot";

export interface LedgerAction {
  kind: typeof SHOP_ACTION.taxes;
  payload: { from: string; to: string };
}

/**
 * Of what the shop invoiced last week, the GST and QST it collected minus the credits of last week's expenses: the money
 * to set aside for the return — and what is really the shop's. Computed with the ledger's own rules; Akinaza prepares, the
 * merchant files.
 */
export function taxProvision({ snapshot }: BriefContext) {
  const { invoices, expenses } = snapshot.lastWeek;
  if (invoices.length === 0) return [];
  const entries = [...invoices.flatMap(invoiceEntries), ...expenses.flatMap(expenseEntries)];
  const gst = balance(entries, "gst");
  const qst = balance(entries, "qst");
  const invoicedCents = invoices.reduce((s, i) => s + i.totalCents, 0);
  const setAsideCents = Math.max(0, gst.net + qst.net);
  const days = [...invoices.map((i) => i.issuedOn), ...expenses.map((e) => e.paidOn)].sort();
  const action: LedgerAction = { kind: SHOP_ACTION.taxes, payload: { from: days[0]!, to: days.at(-1)! } };
  return [
    recommendation({
      week: snapshot.week,
      kind: BRIEF_KIND.taxes,
      subject: "lastWeek",
      urgency: "week",
      impactCents: setAsideCents,
      figures: { invoicedCents, collectedCents: gst.collected + qst.collected, creditsCents: gst.credits + qst.credits, setAsideCents, availableCents: invoicedCents - setAsideCents },
      assumptions: ["preparedNotFiled"],
      evidence: entries.map((e) => `${e.source.kind}:${e.source.id}`).filter((v, i, all) => all.indexOf(v) === i),
      action,
    }),
  ];
}
