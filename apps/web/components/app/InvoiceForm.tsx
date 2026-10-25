"use client";

import { PlusIcon, TrashIcon } from "@krizaka/icons";
import { Alert } from "@krizaka/ui/alert";
import { Button, IconButton } from "@krizaka/ui/button";
import { createKrizakaForm, useFormValue } from "@krizaka/ui/form";
import { StickyAction } from "@krizaka/ui/sticky-action";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { z } from "zod";

import { useShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { formatLongDay, formatMoney } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";
import { type DraftLine, draftPreview, draftRequestLines, type DraftService, emptyLine } from "@/lib/invoice-draft";
import { QUANTITY_FIELD } from "@/lib/quantity";

export interface InvoiceFormData {
  /** The shop's today: the date of the invoice. */
  today: string;
  /** The shop charges the GST and the QST (a small supplier charges none). */
  registrant: boolean;
  clients: { id: string; fullName: string; language: "fr" | "en" }[];
  services: DraftService[];
}

export interface InvoiceFormProps {
  data: InvoiceFormData;
  locale: "fr" | "en";
  /** Where the form starts: the client and the lines of its address (« Facturer ce client », a finished appointment). */
  start: { clientId: string; lines: DraftLine[] };
}

/**
 * The phone's tab bar is 3.5 rem plus the safe area (`RailNav`); the sticky total sits above it, never under it, until
 * krizaka-ui#630 gives the rail a task mode that yields. From `lg` the total is beside the form.
 */
export const STICKY_CLEARS_TAB_BAR = "bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 pb-3 md:block lg:hidden";

const invoiceForm = createKrizakaForm({
  schema: z.object({
    clientId: z.string(),
    lines: z
      .array(z.object({ key: z.string(), serviceId: z.string(), description: z.string().trim().max(200), quantity: QUANTITY_FIELD, unitPriceCents: z.number().int().min(0) }))
      .min(1)
      .max(40),
  }),
  defaultValues: { clientId: "", lines: [emptyLine("l0")] },
});

type Field = `lines[${number}].${"serviceId" | "description" | "quantity" | "unitPriceCents"}`;

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="flex items-baseline gap-3 text-lg font-semibold text-fg">
        <span className="text-sm font-semibold tabular-nums text-fg-accent">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The total of the lines being typed, as the server will compute it. */
function Totals({ data }: { data: InvoiceFormData }) {
  const { say, locale } = useSay();
  const lines = useFormValue<DraftLine[]>("lines");
  const totals = draftPreview(lines ?? [], data.services, { registrant: data.registrant });
  if (!totals) return <p className="text-sm text-fg-secondary">{say("invoices.new.totalPending")}</p>;
  const rows: [string, number][] = [
    [say("invoiceDoc.subtotal"), totals.subtotalCents],
    [say("invoiceDoc.gst"), totals.gstCents],
    [say("invoiceDoc.qst"), totals.qstCents],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" aria-live="polite">
      {rows.map(([term, cents]) => (
        <div key={term} className="contents">
          <dt className="text-fg-secondary">{term}</dt>
          <dd className="text-right tabular-nums text-fg">{formatMoney(cents, locale)}</dd>
        </div>
      ))}
      <dt className="border-t border-border-default pt-1 font-semibold text-fg">{say("invoiceDoc.total")}</dt>
      <dd className="border-t border-border-default pt-1 text-right text-base font-bold tabular-nums text-fg">{formatMoney(totals.totalCents, locale)}</dd>
    </dl>
  );
}

/**
 * « Nouvelle facture » (D3): 01 Pour qui ? (a client file, or none), 02 Quoi ? (lines added and removed: a service of the shop
 * at its price, or free words with their own price, each with its quantity to the hundredth), 03 Quand ? (today, under the
 * shop's terms; the number is given at issue). The total stays in view — beside the form on a desktop, in a sticky action on a
 * phone — and is the server's own computation (`draftPreview`). Issued, it opens the invoice, whose next primary is « Envoyer ».
 */
export function InvoiceForm({ data, locale: base, start }: InvoiceFormProps) {
  const { say, locale } = useSay();
  const call = useCall();
  const router = useRouter();
  const routes = useShopRoutes();
  const [needLine, setNeedLine] = useState(false);
  const keys = useRef(start.lines.length);
  const form = invoiceForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: start,
    onSubmit: async (values) => {
      const lines = draftRequestLines(values.lines);
      setNeedLine(lines.length === 0);
      if (lines.length === 0) return;
      // The invoice is in the client's language (the shop's page language without a client), dated today, under the shop's terms.
      const language = data.clients.find((c) => c.id === values.clientId)?.language ?? base;
      const done = await call.run<{ id: string }>("/api/walker/invoices", { json: { clientId: values.clientId || null, language, issuedOn: data.today, lines } }, { refresh: false });
      if (done !== null) router.push(`${routes.invoice(done.id)}?issued=1`);
    },
  });
  const name = (s: { nameFr: string; nameEn: string }) => ({ fr: s.nameFr, en: s.nameEn })[locale];
  const serviceOptions = [...data.services.map((s) => ({ value: s.id, label: `${name(s)} · ${formatMoney(s.priceCents, locale)}` })), { value: "", label: say("invoices.new.freeLine") }];
  const submit = (
    <form.Submit size="lg" variant="gradient" className="w-full font-bold" data-primary>
      {say("invoices.new.submit")}
    </form.Submit>
  );
  return (
    <form.Form aria-label={say("invoices.new.title")} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-8">
        <Step n="01" title={say("invoices.new.steps.who")}>
          <form.Select name="clientId" label={say("invoices.new.client")} options={[{ value: "", label: say("invoices.new.noClient") }, ...data.clients.map((c) => ({ value: c.id, label: c.fullName }))]} />
        </Step>
        <Step n="02" title={say("invoices.new.steps.what")}>
          <form.FieldArray name="lines">
            {(array) => (
              <div className="flex flex-col gap-4">
                <ol className="flex flex-col gap-4">
                  {(array.items as DraftLine[]).map((line, i) => (
                    <li key={line.key} className="grid gap-3 border-b border-border-subtle pb-4 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end" aria-label={say("invoices.new.line", { n: i + 1 })}>
                      <form.Select name={array.fieldName(i, "serviceId") as Field} label={say("invoices.new.service")} options={serviceOptions} />
                      <form.TextField name={array.fieldName(i, "quantity") as Field} label={say("invoices.new.quantity")} inputMode="decimal" />
                      <IconButton type="button" variant="ghost" label={say("invoices.new.removeLine", { n: i + 1 })} disabled={array.items.length === 1} onClick={() => array.remove(i)}>
                        <TrashIcon size={18} aria-hidden />
                      </IconButton>
                      {line.serviceId === "" ? (
                        <div className="grid gap-3 sm:col-span-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                          <form.TextField name={array.fieldName(i, "description") as Field} label={say("invoices.new.description")} />
                          <form.Money name={array.fieldName(i, "unitPriceCents") as Field} label={say("invoices.new.unitPrice")} currency="CAD" />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <div>
                  <Button type="button" variant="secondary" size="md" onClick={() => array.push(emptyLine(`l${keys.current++}`, data.services[0]?.id ?? ""))}>
                    <PlusIcon size={16} aria-hidden />
                    {say("invoices.new.addLine")}
                  </Button>
                </div>
              </div>
            )}
          </form.FieldArray>
        </Step>
        <Step n="03" title={say("invoices.new.steps.when")}>
          <p className="max-w-prose text-fg-secondary">{say("invoices.new.when", { date: formatLongDay(data.today, locale) })}</p>
        </Step>
        {needLine ? <Alert tone="danger">{say("invoices.new.needLine")}</Alert> : null}
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      </div>
      <aside className="hidden flex-col gap-4 rounded-lg border border-border-default bg-surface-1 p-5 lg:sticky lg:top-20 lg:flex" aria-label={say("invoices.new.totals")} data-testid="invoice-aside">
        <h2 className="text-base font-semibold text-fg">{say("invoices.new.totals")}</h2>
        <Totals data={data} />
        {submit}
      </aside>
      <StickyAction className={STICKY_CLEARS_TAB_BAR} data-testid="invoice-sticky">
        <Totals data={data} />
        {submit}
      </StickyAction>
    </form.Form>
  );
}
