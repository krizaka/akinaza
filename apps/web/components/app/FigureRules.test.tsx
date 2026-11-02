import { OWNER_BOUNDS } from "@akinaza/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { bindProduct } from "@/lib/brand";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { FigureRules } from "./FigureRules";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

const say = (key: string, vars?: Record<string, string | number>) => {
  const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en.console) as string;
  return vars ? Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), value) : value;
};
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say, locale: "en" }) }));
vi.mock("@/components/app/useCall", () => ({ useCall: () => ({ run: vi.fn(), pending: false, problem: null }) }));

const usual = { overdueWatchPct: 10, overdueAlertPct: 25, collectedWatchPct: 80, collectedAlertPct: 60, marginWatchPct: 30, marginAlertPct: 15, noShowWatchPct: 5, noShowAlertPct: 10, taxPeriodSoonDays: 14 };
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("the owner's thresholds screen (#260)", () => {
  it("names every threshold in words, with the usual value and the bounds, and offers save and back to the usual", () => {
    const t = text(renderToStaticMarkup(<FigureRules tunable usual={usual} overrides={{}} bounds={OWNER_BOUNDS} />));
    for (const word of ["Overdue invoices: keep an eye on it above (%)", "Missed appointments: needs action above (%)", "Usual value 10. You can set it between 1 and 99.", "Usual value 14 days. You can set it between 1 and 60.", "Save my thresholds", "Back to the usual values"]) expect(t).toContain(word);
  });

  it("shows the values read only, with the reason, when the administrator switched tuning off", () => {
    const html = renderToStaticMarkup(<FigureRules tunable={false} usual={usual} overrides={{ overdueWatchPct: 5 }} bounds={OWNER_BOUNDS} />);
    expect(text(html)).toContain("set by Folioviv");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Save my thresholds");
  });

  it("has the same words in French as in English", () => {
    expect(Object.keys(fr.console.figures.rules.fields)).toEqual(Object.keys(en.console.figures.rules.fields));
  });
});
