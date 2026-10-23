import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { TodayInvoices } from "./TodayInvoices";

type Invoice = ComponentProps<typeof TodayInvoices>["invoices"][number];
const invoice = (number: string, patch: Partial<Invoice> = {}): Invoice => ({
  id: `i-${number}`,
  number,
  client: "Camille Roy",
  totalCents: 11_498,
  paidCents: 0,
  dueOn: "2026-10-31",
  creditOf: null,
  superseded: false,
  ...patch,
});
const render = (invoices: Invoice[], locale: Locale = "en") => renderToStaticMarkup(<TodayInvoices invoices={invoices} locale={locale} shopId="s1" today="2026-10-23" />);
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("invoice quick access on Today", () => {
  it("shows only the three latest invoices, in query order, with their links and totals", () => {
    const html = render([invoice("A-0004"), invoice("A-0003"), invoice("A-0002"), invoice("A-0001")]);
    expect(html.indexOf("A-0004")).toBeLessThan(html.indexOf("A-0003"));
    expect(html.indexOf("A-0003")).toBeLessThan(html.indexOf("A-0002"));
    expect(html).not.toContain("A-0001");
    for (const number of ["A-0004", "A-0003", "A-0002"]) expect(html).toContain(`href="/en/app/s1/invoices/i-${number}"`);
    expect(html).toContain('href="/en/app/s1/invoices"');
    expect(readable(html)).toContain(formatMoney(11_498, "en"));
    expect(html).toContain("Camille Roy");
  });

  it("counts overdue invoices beyond the three shown, using payments, credits and corrections", () => {
    const html = render([
      invoice("paid", { dueOn: "2026-10-01", paidCents: 11_498 }),
      invoice("cancelled", { dueOn: "2026-10-01", superseded: true }),
      invoice("credit", { dueOn: "2026-10-01", creditOf: "old", totalCents: -11_498 }),
      invoice("overdue", { dueOn: "2026-10-22" }),
      invoice("partly-overdue", { dueOn: "2026-10-22", paidCents: 5_000 }),
      invoice("due-today", { dueOn: "2026-10-23" }),
      invoice("no-due-date", { dueOn: null }),
    ]);
    expect(readable(html)).toContain("Overdue invoices: 2");
    for (const state of ["Paid", "Cancelled", "Credit note"]) expect(readable(html)).toContain(state);
  });

  it.each([["en", en], ["fr", fr]] as const)("uses the %s catalogue for states and links", (locale, messages) => {
    const html = render([invoice("due"), invoice("partial", { paidCents: 5_000 }), invoice("late", { dueOn: "2026-10-22", client: null })], locale);
    const text = readable(html);
    expect(text).toContain(messages.console.today.invoices.title);
    expect(text).toContain(messages.console.invoices.back);
    for (const state of ["due", "partial", "overdue"] as const) expect(text).toContain(messages.console.invoices.state[state]);
    expect(text).toContain(messages.console.invoices.list.noClient);
    expect(html).toContain(`href="/${locale}/app/s1/invoices"`);
    expect(text).toContain(formatMoney(11_498, locale).replace(/\s+/g, " "));
  });

  it("renders nothing when the shop has no invoices", () => {
    expect(render([])).toBe("");
  });
});
