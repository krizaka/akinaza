"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { formatLongDay } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface TimeOffData {
  staff: { id: string; name: string }[];
  timeOff: { staffId: string; name: string; from: string; to: string; reason: string | null }[];
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A date range reads from its first day to its last: `YYYY-MM-DD` compares as text. An empty end is not judged here (the form asks for it). */
export const timeOffOrderOk = (from: string, to: string): boolean => !from || !to || to >= from;

const timeOffForm = createKrizakaForm({
  // A reversed range is refused by the server (AK_TIME_OFF_ORDER), in the shop's words.
  schema: z.object({ staffId: z.string().min(1), from: day, to: day, reason: z.string().trim().max(120) }),
  defaultValues: { staffId: "", from: "", to: "", reason: "" },
});

/** Time off for anyone on the team, as a date range (akinaza#208): the booking slots leave those days out, Today says who is off. */
export function TimeOffCard({ data }: Readonly<{ data: TimeOffData }>) {
  const { say, locale } = useSay();
  const call = useCall();
  const [reversed, setReversed] = useState(false);
  const i18n = { t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale };
  const form = timeOffForm.useForm({
    i18n,
    defaultValues: { staffId: data.staff[0]?.id ?? "", from: "", to: "", reason: "" },
    onSubmit: async (values) => {
      setReversed(!timeOffOrderOk(values.from, values.to));
      if (!timeOffOrderOk(values.from, values.to)) return;
      if ((await call.run("/api/walker/time-off", { json: { staffId: values.staffId, from: values.from, to: values.to, reason: values.reason || undefined } })) !== null) form.reset();
    },
  });
  const when = (from: string, to: string) => (from === to ? formatLongDay(from, locale) : say("team.timeOff.range", { from: formatLongDay(from, locale), to: formatLongDay(to, locale) }));
  return (
    <Card.Root className="p-4">
      <h2 className="mb-1 font-display text-base font-bold text-fg">{say("team.timeOff.title")}</h2>
      <p className="mb-3 text-sm text-fg-secondary">{say("team.timeOff.lead")}</p>
      {data.timeOff.length ? (
        <ul className="mb-4 flex flex-col divide-y divide-border-default">
          {data.timeOff.map((t) => (
            <li key={`${t.staffId}-${t.from}`} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-fg">
                <span className="font-semibold">{t.name}</span> · {when(t.from, t.to)}
                {t.reason ? <span className="text-fg-secondary"> · {t.reason}</span> : null}
              </span>
              <Button size="sm" variant="ghost" aria-label={say("team.timeOff.remove", { name: t.name, when: when(t.from, t.to) })} onClick={() => call.run("/api/walker/time-off", { method: "DELETE", json: { staffId: t.staffId, from: t.from, to: t.to } })}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-fg-secondary">{say("team.timeOff.none")}</p>
      )}
      <form.Form aria-label={say("team.timeOff.title")} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <form.Select name="staffId" label={say("team.timeOff.who")} options={data.staff.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        <form.TextField name="from" label={say("team.timeOff.from")} placeholder="2026-12-20" inputMode="numeric" />
        <form.TextField name="to" label={say("team.timeOff.to")} placeholder="2026-12-27" inputMode="numeric" />
        <div className="col-span-2">
          <form.TextField name="reason" label={say("team.timeOff.reason")} hint={say("team.timeOff.reasonHint")} />
        </div>
        <div className="col-span-2 flex flex-col gap-3">
          {reversed ? <Alert tone="danger">{say("team.timeOff.order")}</Alert> : null}
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          <form.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">
            {say("team.timeOff.add")}
          </form.Submit>
        </div>
      </form.Form>
    </Card.Root>
  );
}
