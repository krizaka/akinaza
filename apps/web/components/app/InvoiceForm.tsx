"use client";

import { PAYMENT_TERMS_CHOICES } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

export interface InvoiceFormData {
  today: string;
  /** The shop's own payment terms, in days: what an invoice is issued under unless the owner picks other terms. */
  termsDays: number;
  clients: { id: string; fullName: string; language: "fr" | "en" }[];
  services: { id: string; nameFr: string; nameEn: string; priceCents: number }[];
}

const money = (cents: number, locale: string) => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

const quantity = z.string().regex(/^\d{0,4}$/);
const invoiceForm = createKrizakaForm({
  schema: z.object({
    clientId: z.string(),
    language: z.enum(["fr", "en"]),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    terms: z.string(),
    service1: z.string(),
    quantity1: quantity,
    service2: z.string(),
    quantity2: quantity,
    service3: z.string(),
    quantity3: quantity,
    customDescription: z.string().trim().max(200),
    customPrice: z.number().int().min(0),
    customQuantity: quantity,
  }),
  defaultValues: { clientId: "", language: "fr" as const, issuedOn: "", terms: "", service1: "", quantity1: "1", service2: "", quantity2: "1", service3: "", quantity3: "1", customDescription: "", customPrice: 0, customQuantity: "1" },
});

/**
 * « New invoice »: a client, a language, up to three services of the shop with their quantities (hours, days, packages)
 * and one free line with its own price. The server computes the GST and the QST once on the taxable total, to the cent,
 * and posts the ledger in the same transaction; the form only says what to bill.
 */
export function InvoiceForm({ data, locale: base }: { data: InvoiceFormData; locale: "fr" | "en" }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [needLine, setNeedLine] = useState(false);
  const form = invoiceForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: { clientId: "", language: base, issuedOn: data.today, terms: "", service1: "", quantity1: "1", service2: "", quantity2: "1", service3: "", quantity3: "1", customDescription: "", customPrice: 0, customQuantity: "1" },
    onSubmit: async (values) => {
      const lines: Record<string, unknown>[] = [];
      for (const n of [1, 2, 3] as const) {
        const serviceId = values[`service${n}`];
        const qty = Number(values[`quantity${n}`]);
        if (serviceId && qty >= 1) lines.push({ serviceId, quantity: qty });
      }
      if (values.customDescription.trim() && Number(values.customQuantity) >= 1) lines.push({ description: values.customDescription.trim(), quantity: Number(values.customQuantity), unitPriceCents: values.customPrice });
      setNeedLine(lines.length === 0);
      if (lines.length === 0) return;
      const done = await call.run<{ id: string }>("/api/walker/invoices", { json: { clientId: values.clientId || null, language: values.language, issuedOn: values.issuedOn, lines, ...(values.terms === "" ? {} : { termsDays: Number(values.terms) }) } });
      if (done !== null) form.reset();
    },
  });
  const termsLabel = (days: number) => (days === 0 ? say("invoices.new.termsOnReceipt") : say("invoices.new.termsNet", { days }));
  const termsOptions = [{ value: "", label: say("invoices.new.termsDefault", { days: data.termsDays }) }, ...PAYMENT_TERMS_CHOICES.map((days) => ({ value: String(days), label: termsLabel(days) }))];
  const serviceOptions = [{ value: "", label: say("invoices.new.noService") }, ...data.services.map((s) => ({ value: s.id, label: `${locale === "fr" ? s.nameFr : s.nameEn} · ${money(s.priceCents, locale)}` }))];
  return (
    <Card.Root className="p-4">
      <h2 className="mb-3 font-display text-base font-bold text-fg">{say("invoices.new.title")}</h2>
      <form.Form aria-label={say("invoices.new.title")} className="grid gap-3 sm:grid-cols-2">
        <form.Select name="clientId" label={say("invoices.new.client")} options={[{ value: "", label: say("invoices.new.noClient") }, ...data.clients.map((c) => ({ value: c.id, label: c.fullName }))]} />
        <form.Select name="language" label={say("invoices.new.language")} options={(["fr", "en"] as const).map((l) => ({ value: l, label: say(`invoices.new.languages.${l}`) }))} />
        <form.DateField name="issuedOn" label={say("invoices.new.issuedOn")} entry="parts" labels={{ day: say("invoices.new.day"), month: say("invoices.new.month"), year: say("invoices.new.year") }} />
        <form.Select name="terms" label={say("invoices.new.terms")} hint={say("invoices.new.termsHint")} options={termsOptions} />
        <p className="text-xs text-fg-muted sm:col-span-2">{say("invoices.new.quantityHint")}</p>
        {([1, 2, 3] as const).map((n) => (
          <div key={n} className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_8rem]">
            <form.Select name={`service${n}`} label={say("invoices.new.service", { n })} options={serviceOptions} />
            <form.TextField name={`quantity${n}`} label={say("invoices.new.quantity")} inputMode="numeric" />
          </div>
        ))}
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_10rem_8rem]">
          <form.TextField name="customDescription" label={say("invoices.new.customDescription")} />
          <form.Money name="customPrice" label={say("invoices.new.customPrice")} currency="CAD" />
          <form.TextField name="customQuantity" label={say("invoices.new.customQuantity")} inputMode="numeric" />
        </div>
        <p className="text-xs text-fg-muted sm:col-span-2">{say("invoices.new.taxes")}</p>
        <div className="flex flex-col gap-3 sm:col-span-2">
          {needLine ? <Alert tone="danger">{say("invoices.new.needLine")}</Alert> : null}
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          <div>
            <form.Submit size="md" variant="primary" className="w-full sm:w-auto">
              {say("invoices.new.submit")}
            </form.Submit>
          </div>
        </div>
      </form.Form>
    </Card.Root>
  );
}
