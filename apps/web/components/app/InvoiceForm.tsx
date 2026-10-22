"use client";

import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { useShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { parseQuantity, QUANTITY_FIELD } from "@/lib/quantity";

export interface InvoiceFormData {
  /** The shop's today: the date of the invoice. */
  today: string;
  clients: { id: string; fullName: string; language: "fr" | "en" }[];
  services: { id: string; nameFr: string; nameEn: string; priceCents: number }[];
}

const money = (cents: number, locale: string) => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

const quantity = QUANTITY_FIELD;
const invoiceForm = createKrizakaForm({
  schema: z.object({
    clientId: z.string(),
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
  defaultValues: { clientId: "", service1: "", quantity1: "1", service2: "", quantity2: "1", service3: "", quantity3: "1", customDescription: "", customPrice: 0, customQuantity: "1" },
});

/**
 * « New invoice »: a client, up to three services of the shop with their quantities (hours, days, packages)
 * and one free line with its own price. The language, the date and the terms are the defaults (the client's language, today, the shop's terms). The server computes the GST and the QST once on the taxable total, to the cent,
 * and posts the ledger in the same transaction; the form only says what to bill.
 */
export function InvoiceForm({ data, locale: base }: { data: InvoiceFormData; locale: "fr" | "en" }) {
  const { say, locale } = useSay();
  const call = useCall();
  const router = useRouter();
  const routes = useShopRoutes();
  const [needLine, setNeedLine] = useState(false);
  const form = invoiceForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: { clientId: "", service1: "", quantity1: "1", service2: "", quantity2: "1", service3: "", quantity3: "1", customDescription: "", customPrice: 0, customQuantity: "1" },
    onSubmit: async (values) => {
      const lines: Record<string, unknown>[] = [];
      for (const n of [1, 2, 3] as const) {
        const serviceId = values[`service${n}`];
        const qty = parseQuantity(values[`quantity${n}`]);
        if (serviceId && qty !== null) lines.push({ serviceId, quantity: qty });
      }
      const customQuantity = parseQuantity(values.customQuantity);
      if (values.customDescription.trim() && customQuantity !== null) lines.push({ description: values.customDescription.trim(), quantity: customQuantity, unitPriceCents: values.customPrice });
      setNeedLine(lines.length === 0);
      if (lines.length === 0) return;
      // The invoice is in the client's language (the shop's page language without a client), dated today, under the shop's terms.
      const language = data.clients.find((c) => c.id === values.clientId)?.language ?? base;
      const done = await call.run<{ id: string }>("/api/walker/invoices", { json: { clientId: values.clientId || null, language, issuedOn: data.today, lines } }, { refresh: false });
      if (done !== null) router.push(routes.invoice(done.id));
    },
  });
  const serviceOptions = [{ value: "", label: say("invoices.new.noService") }, ...data.services.map((s) => ({ value: s.id, label: `${locale === "fr" ? s.nameFr : s.nameEn} · ${money(s.priceCents, locale)}` }))];
  return (
    <Card.Root className="p-4">
      <h2 className="mb-3 font-display text-base font-bold text-fg">{say("invoices.new.title")}</h2>
      <form.Form aria-label={say("invoices.new.title")} className="grid gap-3 sm:grid-cols-2">
        <form.Select name="clientId" className="sm:col-span-2" label={say("invoices.new.client")} options={[{ value: "", label: say("invoices.new.noClient") }, ...data.clients.map((c) => ({ value: c.id, label: c.fullName }))]} />
        {([1, 2, 3] as const).map((n) => (
          <div key={n} className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_8rem]">
            <form.Select name={`service${n}`} label={say("invoices.new.service", { n })} options={serviceOptions} />
            <form.TextField name={`quantity${n}`} label={say("invoices.new.quantity")} inputMode="decimal" />
          </div>
        ))}
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_10rem_8rem]">
          <form.TextField name="customDescription" label={say("invoices.new.customDescription")} />
          <form.Money name="customPrice" label={say("invoices.new.customPrice")} currency="CAD" />
          <form.TextField name="customQuantity" label={say("invoices.new.customQuantity")} inputMode="decimal" />
        </div>
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
