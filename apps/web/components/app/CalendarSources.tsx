"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import type { CalendarOverview } from "@/lib/calendar/overview";
import { useSay } from "@/lib/i18n-client";

const sourceForm = createKrizakaForm({
  schema: z.object({ label: z.string().trim().min(1).max(80), url: z.string().trim().min(8).max(2000), staffId: z.string(), consent: z.boolean() }),
  defaultValues: { label: "", url: "", staffId: "", consent: false },
});

const STATE_TONE = { ok: "success", error: "danger", pending: "neutral" } as const;

/** One connected calendar: its state, « read again » and « disconnect ». The address is never shown: it is sealed on the server. */
function SourceRow({ c, who }: { c: CalendarOverview["connections"][number]; who: string }) {
  const { say, locale } = useSay();
  const call = useCall();
  const t = (key: string, vars?: Record<string, string | number>) => say(`boutique.agenda.sources.${key}`, vars);
  const read = c.lastSuccessAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(c.lastSuccessAt)) : null;
  return (
    <li className="flex flex-col gap-2 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words font-semibold text-fg">{c.label}</span>
        <Badge tone={STATE_TONE[c.state]} size="sm">{t(`state.${c.state}`)}</Badge>
        <span className="text-sm text-fg-muted">{who}</span>
      </div>
      <p className="m-0 text-sm text-fg-muted">{read ? t("lastRead", { when: read }) : t("neverRead")}</p>
      {c.state === "error" && c.lastError ? <Alert tone="warning">{say(`errors.${c.lastError.replace(/^AK_/, "")}`)}</Alert> : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="md" variant="secondary" disabled={call.pending} onClick={() => call.run(`/api/walker/calendars/${c.id}/sync`)}>
          {t("refresh")}
        </Button>
        <Button
          type="button"
          size="md"
          variant="ghost"
          disabled={call.pending}
          onClick={async () => {
            if (window.confirm(t("removeConfirm"))) await call.run("/api/walker/calendars", { method: "DELETE", json: { id: c.id } });
          }}
        >
          {t("remove")}
        </Button>
      </div>
    </li>
  );
}

/** « Vos autres agendas » (ADR-004): the calendars the owner already uses, read-only; their busy times keep those slots free of bookings. */
export function CalendarSources({ overview }: { overview: CalendarOverview }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [needConsent, setNeedConsent] = useState(false);
  const t = (key: string, vars?: Record<string, string | number>) => say(`boutique.agenda.sources.${key}`, vars);
  const i18n = { t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale };
  const everyone = overview.wholeShop ? [{ value: "", label: t("wholeShop") }] : [];
  const options = [...everyone, ...overview.people.map((p) => ({ value: p.id, label: p.name }))];
  const form = sourceForm.useForm({
    i18n,
    defaultValues: { label: "", url: "", staffId: options[0]?.value ?? "", consent: false },
    onSubmit: async (values) => {
      setNeedConsent(!values.consent);
      if (!values.consent) return;
      const made = await call.run("/api/walker/calendars", { json: { kind: "ics", url: values.url, label: values.label, staffId: values.staffId || null, consent: true } });
      if (made !== null) form.reset();
    },
  });
  if (!overview.enabled || !overview.kinds.includes("ics")) return <Alert tone="info">{t("off")}</Alert>;
  const whoIs = (staffId: string | null) => (staffId === null ? t("wholeShop") : (overview.people.find((p) => p.id === staffId)?.name ?? ""));
  return (
    <div className="flex flex-col gap-4">
      <Card.Root className="flex flex-col gap-4 p-4">
        <div>
          <h3 className="font-display text-base font-bold text-fg">{t("title")}</h3>
          <p className="m-0 mt-1 text-sm text-fg-secondary">{t("lead")}</p>
        </div>
        {overview.connections.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {overview.connections.map((c) => (
              <SourceRow key={c.id} c={c} who={whoIs(c.staffId)} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-fg-secondary">{t("none")}</p>
        )}
      </Card.Root>
      <Card.Root className="p-4">
        <h3 className="mb-3 font-display text-base font-bold text-fg">{t("add")}</h3>
        <form.Form aria-label={t("add")} className="grid gap-3 sm:grid-cols-2">
          <form.TextField name="label" label={t("label")} hint={t("labelHint")} />
          {options.length > 1 ? <form.Select name="staffId" label={t("whose")} options={options} /> : <span />}
          <div className="sm:col-span-2">
            <form.TextField name="url" label={t("url")} hint={t("urlHint")} inputMode="url" />
          </div>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <form.Checkbox name="consent" label={t("consent")} />
            {needConsent ? <Alert tone="danger">{t("needConsent")}</Alert> : null}
            {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
            <form.Submit size="md" variant="primary" className="w-full sm:w-auto sm:self-start">
              {t("connect")}
            </form.Submit>
          </div>
        </form.Form>
      </Card.Root>
    </div>
  );
}
