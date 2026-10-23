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
 * « Envoyer la facture »: the client's e-mail and a message, in a dialog, then the e-mail is queued. The invoice page makes
 * it its primary action (docs/ux/2026-10-full-review.md D3); the list's unfolded row keeps it quiet.
 */
export function InvoiceSendAction({ invoiceId, email, defaultMessage = "", variant = "secondary", size = "sm" }: { invoiceId: string; email: string | null; defaultMessage?: string; variant?: "primary" | "secondary"; size?: "sm" | "md" }) {
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
    <>
      <Button
        size={size}
        variant={variant}
        shape={variant === "primary" ? "cut" : undefined}
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
      >
        {say("invoices.send.open")}
      </Button>
      {sent ? (
        <Alert tone="success" className="basis-full">
          {say("invoices.send.queued")}
        </Alert>
      ) : null}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content closeLabel={say("invoices.send.close")}>
          <Dialog.Header>
            <Dialog.Title>{say("invoices.send.title")}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <form.Form aria-label={say("invoices.send.title")} className="flex flex-col gap-3">
              <form.TextField name="toEmail" label={say("invoices.send.email")} type="email" autoComplete="email" />
              <form.TextArea name="message" label={say("invoices.send.message")} rows={3} maxLength={500} />
              {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
              <div>
                <form.Submit size="md" variant="primary" disabled={call.pending}>
                  {say("invoices.send.submit")}
                </form.Submit>
              </div>
            </form.Form>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
