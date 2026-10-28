"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Dialog } from "@krizaka/ui/dialog";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useEffect, useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

const sendInvoiceForm = createKrizakaForm({
  schema: z.object({ toEmail: z.string().trim().min(1).email().max(320), message: z.string().trim().max(500) }),
  defaultValues: { toEmail: "", message: "" },
});

/**
 * « Envoyer la facture »: a button opening the sending form in a dialog (the address, an optional message). On the invoice's
 * page it is the screen's one primary (`primary`, the hero primary); in a list's row it is a quiet secondary. Once sent, the
 * button rings once (`data-kz-status="success"`, motion.css, D11).
 */
export function InvoiceSendAction({ invoiceId, email, defaultMessage = "", primary = false }: { invoiceId: string; email: string | null; defaultMessage?: string; primary?: boolean }) {
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
    <div className="flex flex-col gap-2">
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (next) setSent(false);
          setOpen(next);
        }}
      >
        <Dialog.Trigger asChild>
          {primary ? (
            <Button size="md" variant="primary" className="font-bold" data-primary data-kz-status={sent ? "success" : undefined}>
              {say("invoices.send.open")}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" data-kz-status={sent ? "success" : undefined}>
              {say("invoices.send.open")}
            </Button>
          )}
        </Dialog.Trigger>
        <Dialog.Content closeLabel={say("invoices.send.close")}>
          <Dialog.Header>
            <Dialog.Title>{say("invoices.send.title")}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <form.Form aria-label={say("invoices.send.title")} className="flex flex-col gap-3">
              <form.TextField name="toEmail" label={say("invoices.send.email")} type="email" autoComplete="email" />
              <form.TextArea name="message" label={say("invoices.send.message")} rows={3} maxLength={500} />
              {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
              <form.Submit size="md" variant="primary" disabled={call.pending}>
                {say("invoices.send.submit")}
              </form.Submit>
            </form.Form>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Root>
      {sent ? <Alert tone="success">{say("invoices.send.queued")}</Alert> : null}
    </div>
  );
}
