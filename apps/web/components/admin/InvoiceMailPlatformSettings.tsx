"use client";

import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useEffect } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

const platformForm = createKrizakaForm({
  schema: z.object({ maxPerShopPerDay: z.coerce.number().int().min(1).max(10_000), allowedSenderDomain: z.string().trim().max(253) }),
  defaultValues: { maxPerShopPerDay: 50, allowedSenderDomain: "" },
});

export function InvoiceMailPlatformSettings({ initial }: { initial: { maxPerShopPerDay: number; allowedSenderDomain: string | null } }) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = platformForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      await call.run("/api/admin/invoice-mail-settings", { method: "PUT", json: { ...values, allowedSenderDomain: values.allowedSenderDomain || null } });
    },
  });
  useEffect(() => {
    form.reset({ maxPerShopPerDay: initial.maxPerShopPerDay, allowedSenderDomain: initial.allowedSenderDomain ?? "" });
  }, [form, initial]);
  const t = (key: string) => say(`admin.invoiceMail.${key}`);
  return (
    <Card.Root className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-lg font-bold text-fg">{t("title")}</h2>
      <form.Form aria-label={t("title")} className="flex flex-col gap-3">
        <form.TextField name="maxPerShopPerDay" label={t("limit")} />
        <form.TextField name="allowedSenderDomain" label={t("domain")} />
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <form.Submit size="md" disabled={call.pending}>{t("save")}</form.Submit>
      </form.Form>
    </Card.Root>
  );
}
