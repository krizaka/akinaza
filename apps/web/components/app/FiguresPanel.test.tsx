import { computeFigures, DEFAULT_FIGURE_THRESHOLDS, nextActions } from "@akinaza/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { shopRoutes } from "@/lib/routes";

import { FiguresPanel } from "./FiguresPanel";
import { LexiconSection } from "./LexiconSection";
import { WhatToDoNow } from "./WhatToDoNow";

const routes = shopRoutes("en", "11111111-1111-4111-8111-111111111111");
const INPUT = {
  today: "2026-10-23",
  computedAt: "2026-10-23T12:00:00.000Z",
  period: { start: "2026-10-01", end: "2026-12-31" },
  invoices: [
    { id: "inv-a", number: "F-0001", issuedOn: "2026-10-03", dueOn: "2026-10-10", subtotalCents: 10_000, gstCents: 500, qstCents: 998, totalCents: 11_498, paidCents: 5_000, isCredit: false, superseded: false },
    { id: "inv-b", number: "F-0002", issuedOn: "2026-10-05", dueOn: "2026-10-12", subtotalCents: 2_000, gstCents: 100, qstCents: 200, totalCents: 2_300, paidCents: 0, isCredit: false, superseded: false },
  ],
  payments: [{ id: "pay-a", invoiceId: "inv-a", amountCents: 5_000, receivedOn: "2026-10-05" }],
  expenses: [],
  appointments: [{ id: "a1", day: "2026-10-04", status: "done" as const }],
};
const figures = computeFigures(INPUT, DEFAULT_FIGURE_THRESHOLDS);

describe("the figures panel (#260)", () => {
  const html = renderToStaticMarkup(<FiguresPanel ids={["invoiced", "toCollect", "gstToRemit"]} figures={figures} locale="en" routes={routes} timeZone="America/Toronto" now="2026-10-23T13:00:00.000Z" />);

  it("renders one explained article per figure: meaning, formula, source, freshness and state", () => {
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).toContain("What your clients still owe you today");
    expect(html).toContain("Invoices with taxes $137.98");
    expect(html).toContain("2 invoices");
    expect(html).toContain(`href="${routes.invoices}"`);
    expect(html).toContain("Updated");
    expect(html).toContain("Needs action");
  });

  it("explains its words with the lexique, the ones for an accountant marked", () => {
    expect(html).toContain("GST / QST");
    expect(html).toContain("Return period");
    expect(html).toContain("· Of which overdue $87.98");
  });

  it("is stale after a day", () => {
    const stale = renderToStaticMarkup(<FiguresPanel ids={["invoiced"]} figures={figures} locale="en" routes={routes} timeZone="UTC" now="2026-10-25T00:00:00.000Z" />);
    expect(stale).toContain("May be out of date");
    expect(html).not.toContain("May be out of date");
  });
});

describe("what to do now (#260)", () => {
  const actions = nextActions({ figures: INPUT, returnPrepared: false, slots: [{ weekday: 2, startsAt: "09:00", offered: 8, booked: 1 }] }, DEFAULT_FIGURE_THRESHOLDS, ["chase", "slot"]);

  it("lists two actions with their reason and the way in", () => {
    const html = renderToStaticMarkup(<WhatToDoNow actions={actions} locale="fr" routes={routes} />);
    expect(html).toContain("Que faire maintenant");
    expect(html).toContain(`href="${routes.invoice("inv-a")}"`);
    expect(html).toContain("Ouvrir les heures");
  });

  it("shows one action as a card and none as nothing", () => {
    expect(renderToStaticMarkup(<WhatToDoNow actions={actions.slice(0, 1)} locale="en" routes={routes} />)).toContain("Chase invoice F-0001");
    expect(renderToStaticMarkup(<WhatToDoNow actions={[]} locale="en" routes={routes} />)).toBe("");
  });
});

describe("the lexique (#260)", () => {
  it("lists every word of the figures", () => {
    const html = renderToStaticMarkup(<LexiconSection locale="en" />);
    for (const word of ["GST / QST", "Margin", "No-show", "Return period"]) expect(html).toContain(word);
  });
});
