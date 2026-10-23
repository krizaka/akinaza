"use client";

import { TrashIcon } from "@krizaka/icons";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { cn } from "@krizaka/ui/cn";
import { createKrizakaForm } from "@krizaka/ui/form";
import { StickyAction } from "@krizaka/ui/sticky-action";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { useShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { formatMoney, INTL_LOCALE } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";
import { billableLines, type BillableService, emptyLine, type InvoiceLineInput, previewTotals } from "@/lib/invoice-lines";
import { QUANTITY_FIELD } from "@/lib/quantity";

export interface InvoiceFormData {
  /** The shop's today: the date of the invoice. */
  today: string;
  /** A GST/QST registrant charges the taxes; a small supplier charges none. */
  registrant: boolean;
  clients: { id: string; fullName: string; language: "fr" | "en" }[];
  services: BillableService[];
}

const line = z.object({ serviceId: z.string(), description: z.string().trim().max(200), quantity: QUANTITY_FIELD, unitPriceCents: z.number().int().min(0) });
const invoiceForm = createKrizakaForm({
  schema: z.object({ clientId: z.string(), lines: z.array(line).min(1).max(40) }),
  defaultValues: { clientId: "", lines: [emptyLine()] as InvoiceLineInput[] },
});

/** The figures the invoice will show once issued, from the lines held now: the same rule as the ledger (`previewTotals`). */
function Totals({ lines, services, registrant }: { lines: readonly InvoiceLineInput[]; services: readonly BillableService[]; registrant: boolean }) {
  const { say, locale } = useSay();
  const totals = previewTotals(lines, services, registrant);
  if (totals.count === 0) return <p className="text-sm text-fg-secondary">{say("invoices.new.noLineYet")}</p>;
  const rows: [string, number, boolean][] = [
    [say("invoices.detail.subtotal"), totals.subtotalCents, false],
    ...(registrant ? ([[say("invoices.new.gstRate"), totals.gstCents, false], [say("invoices.new.qstRate"), totals.qstCents, false]] as [string, number, boolean][]) : []),
    [say("invoices.detail.total"), totals.totalCents, true],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" data-testid="invoice-totals">
      {rows.map(([term, cents, strong]) => (
        <div key={term} className={cn("contents text-fg-secondary", strong && "font-semibold text-fg")}>
          <dt className={cn(strong && "border-t border-border-default pt-1")}>{term}</dt>
          <dd className={cn("text-right font-mono tabular-nums text-fg", strong && "border-t border-border-default pt-1")}>{formatMoney(cents, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * « Nouvelle facture » (docs/ux/2026-10-full-review.md D4, D5): a client, then lines added one by one — one of the shop's
 * services at its price, or a free line with its description and price — with their quantities (hours, days, packages),
 * and the total the invoice will carry (subtotal, GST, QST, total) beside them, live, under the ledger's own rule. The
 * language, the date and the terms are the defaults (the client's language, today, the shop's terms). The server computes
 * the taxes once on the taxable total, to the cent, and posts the ledger in the same transaction; the form only says what
 * to bill. On a phone, the action stays at the bottom edge.
 */
export function InvoiceForm({ data, locale: base }: { data: InvoiceFormData; locale: "fr" | "en" }) {
  const { say, locale } = useSay();
  const call = useCall();
  const router = useRouter();
  const routes = useShopRoutes();
  const [needLine, setNeedLine] = useState(false);
  const form = invoiceForm.useForm({
    // fr-CA / en-CA: the money field writes « 0,00 » with the dollar of Canada, not « $CA ».
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale: INTL_LOCALE[locale] },
    defaultValues: { clientId: "", lines: [emptyLine()] },
    onSubmit: async (values) => {
      const lines = billableLines(values.lines);
      setNeedLine(lines.length === 0);
      if (lines.length === 0) return;
      // The invoice is in the client's language (the shop's page language without a client), dated today, under the shop's terms.
      const language = data.clients.find((c) => c.id === values.clientId)?.language ?? base;
      const done = await call.run<{ id: string }>("/api/walker/invoices", { json: { clientId: values.clientId || null, language, issuedOn: data.today, lines } }, { refresh: false });
      if (done !== null) router.push(routes.invoice(done.id));
    },
  });
  const serviceOptions = [{ value: "", label: say("invoices.new.free") }, ...data.services.map((s) => ({ value: s.id, label: `${locale === "fr" ? s.nameFr : s.nameEn} · ${formatMoney(s.priceCents, locale)}` }))];
  return (
    <form.Form aria-label={say("invoices.new.title")} className="grid gap-5 pb-24 lg:grid-cols-[1fr_20rem] lg:pb-0">
      <div className="flex flex-col gap-4">
        <Card.Root className="p-4">
          <form.Select name="clientId" label={say("invoices.new.client")} options={[{ value: "", label: say("invoices.new.noClient") }, ...data.clients.map((c) => ({ value: c.id, label: c.fullName }))]} />
        </Card.Root>
        <Card.Root className="flex flex-col gap-4 p-4">
          <form.FieldArray name="lines">
            {(array) => (
              <>
                {array.items.map((_, i) => (
                  <fieldset key={i} className="flex flex-col gap-3 border-t border-border-subtle pt-3 first:border-t-0 first:pt-0">
                    <legend className="sr-only">{say("invoices.new.line", { n: i + 1 })}</legend>
                    <div className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_auto]">
                      <form.Select name={`lines[${i}].serviceId` as const} label={say("invoices.new.line", { n: i + 1 })} options={serviceOptions} />
                      <form.TextField name={`lines[${i}].quantity` as const} label={say("invoices.new.quantity")} inputMode="decimal" />
                      <Button type="button" variant="ghost" size="sm" aria-label={say("invoices.new.removeLine", { n: i + 1 })} onClick={() => array.remove(i)} disabled={array.items.length === 1}>
                        <TrashIcon size={16} aria-hidden />
                      </Button>
                    </div>
                    <form.Watch name={`lines[${i}].serviceId` as const}>
                      {(serviceId) =>
                        serviceId ? null : (
                          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                            <form.TextField name={`lines[${i}].description` as const} label={say("invoices.new.description")} />
                            <form.Money name={`lines[${i}].unitPriceCents` as const} label={say("invoices.new.unitPrice")} currency="CAD" />
                          </div>
                        )
                      }
                    </form.Watch>
                  </fieldset>
                ))}
                <div>
                  <Button type="button" variant="secondary" size="sm" onClick={() => array.push(emptyLine())}>
                    {say("invoices.new.addLine")}
                  </Button>
                </div>
              </>
            )}
          </form.FieldArray>
        </Card.Root>
        {needLine ? <Alert tone="danger">{say("invoices.new.needLine")}</Alert> : null}
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      </div>
      <aside className="self-start lg:sticky lg:top-20">
        <Card.Root className="flex flex-col gap-3 p-4">
          <h2 className="font-display text-base font-bold text-fg">{say("invoices.new.totals")}</h2>
          <form.Watch name="lines">{(lines) => <Totals lines={lines as InvoiceLineInput[]} services={data.services} registrant={data.registrant} />}</form.Watch>
          <form.Submit size="md" variant="primary" shape="cut" className="hidden w-full lg:inline-flex">
            {say("invoices.new.submit")}
          </form.Submit>
        </Card.Root>
      </aside>
      <StickyAction className="lg:hidden">
        <form.Submit size="lg" variant="primary" shape="cut" className="w-full">
          {say("invoices.new.submit")}
        </form.Submit>
      </StickyAction>
    </form.Form>
  );
}
