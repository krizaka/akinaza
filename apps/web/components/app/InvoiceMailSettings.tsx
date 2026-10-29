"use client";

import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useEffect } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

const settingsForm = createKrizakaForm({
  schema: z.object({
    message: z.string().trim().max(500),
    fromName: z.string().trim().max(120),
    copy: z.boolean(),
    linkDays: z.coerce.number().int().min(1).max(365),
  }),
  defaultValues: { message: "", fromName: "", copy: false, linkDays: 30 },
});

export function InvoiceMailSettings({ initial }: Readonly<{ initial: { message: string; fromName: string | null; copy: boolean; linkDays: number } }>) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = settingsForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      await call.run("/api/walker/invoices/settings", { method: "PUT", json: { ...values, fromName: values.fromName || null } });
    },
  });
  useEffect(() => {
    form.reset({ ...initial, fromName: initial.fromName ?? "" });
  }, [form, initial]);
  const t = (key: string) => say(`invoices.mailSettings.${key}`);
  return (
    <Card.Root className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-lg font-bold text-fg">{t("title")}</h2>
      <form.Form aria-label={t("title")} className="flex flex-col gap-3">
        <form.TextArea name="message" label={t("message")} rows={3} maxLength={500} />
        <form.TextField name="fromName" label={t("fromName")} autoComplete="organization" />
        <form.Switch name="copy" label={t("copy")} />
        <form.TextField name="linkDays" label={t("linkDays")} />
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <form.Submit size="md" disabled={call.pending}>{t("save")}</form.Submit>
      </form.Form>
    </Card.Root>
  );
}
