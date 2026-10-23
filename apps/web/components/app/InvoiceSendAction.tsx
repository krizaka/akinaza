"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useEffect, useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

const sendInvoiceForm = createKrizakaForm({
  schema: z.object({ toEmail: z.string().trim().min(1).email().max(320), message: z.string().trim().max(500) }),
  defaultValues: { toEmail: "", message: "" },
});

export function InvoiceSendAction({ invoiceId, email, defaultMessage = "" }: { invoiceId: string; email: string | null; defaultMessage?: string }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const form = sendInvoiceForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      const result = await call.run(`/api/walker/invoices/${invoiceId}/send`, { json: values });
      if (result) {
        setSent(true);
        setOpen(false);
      }
    },
  });
  useEffect(() => {
    form.reset({ toEmail: email ?? "", message: defaultMessage });
  }, [email, defaultMessage, form]);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => { setSent(false); setOpen((value) => !value); }}>
          {say("invoices.send.open")}
        </Button>
      </div>
      {sent ? <Alert tone="success">{say("invoices.send.queued")}</Alert> : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {open ? (
        <form.Form aria-label={say("invoices.send.title")} className="flex max-w-xl flex-col gap-3 rounded-lg border border-border-default bg-surface-1 p-4">
          <form.TextField name="toEmail" label={say("invoices.send.email")} type="email" autoComplete="email" />
          <form.TextArea name="message" label={say("invoices.send.message")} rows={3} maxLength={500} />
          <form.Submit size="md" disabled={call.pending}>{say("invoices.send.submit")}</form.Submit>
        </form.Form>
      ) : null}
    </section>
  );
}
