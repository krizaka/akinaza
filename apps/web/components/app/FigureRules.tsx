"use client";

import { OWNER_BOUNDS, OWNER_TUNABLE, type OwnerOverrides, type OwnerTunable } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useEffect, useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

type Values = Record<OwnerTunable, number>;

const bounded = (key: OwnerTunable) => z.coerce.number().int().min(OWNER_BOUNDS[key].min).max(OWNER_BOUNDS[key].max);

const rulesForm = createKrizakaForm({
  schema: z.object(Object.fromEntries(OWNER_TUNABLE.map((key) => [key, bounded(key)])) as Record<OwnerTunable, ReturnType<typeof bounded>>),
  defaultValues: Object.fromEntries(OWNER_TUNABLE.map((key) => [key, OWNER_BOUNDS[key].min])) as Values,
});

/** The values the form shows: the owner's own where they set one, the usual (the administrator's) otherwise. */
const shown = (usual: Values, overrides: OwnerOverrides): Values => ({ ...usual, ...overrides });

/** Only what differs from the usual values is kept: « back to the usual » is an empty set, and a later change of the usual values still reaches the shop. */
const changed = (usual: Values, values: Values): OwnerOverrides => Object.fromEntries(OWNER_TUNABLE.filter((key) => values[key] !== usual[key]).map((key) => [key, values[key]]));

/**
 * The thresholds a figure is judged against, for this shop (#260): the usual values are the administrator's, the owner moves them inside the bounds.
 * Only the moment a figure asks for a look or for action changes; the amounts and the formulas never do.
 */
export function FigureRules({ tunable, usual, overrides, bounds }: { tunable: boolean; usual: Values; overrides: OwnerOverrides; bounds: typeof OWNER_BOUNDS }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [saved, setSaved] = useState(false);
  const t = (key: string, vars?: Record<string, string | number>) => say(`figures.rules.${key}`, vars);
  const form = rulesForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      const result = await call.run("/api/walker/figures/rules", { method: "PUT", json: { overrides: changed(usual, values as Values) } });
      setSaved(result !== null);
    },
  });
  useEffect(() => {
    form.reset(shown(usual, overrides));
  }, [form, usual, overrides]);
  if (!tunable) {
    return (
      <Card.Root className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg font-bold text-fg">{t("title")}</h2>
        <Alert tone="info">{t("fixed")}</Alert>
        <dl className="m-0 flex flex-col gap-2">
          {OWNER_TUNABLE.map((key) => (
            <div key={key} className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="min-w-0 text-fg-secondary">{t(`fields.${key}`)}</dt>
              <dd className="m-0 font-semibold tabular-nums text-fg">{usual[key]}</dd>
            </div>
          ))}
        </dl>
      </Card.Root>
    );
  }
  return (
    <Card.Root className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-lg font-bold text-fg">{t("title")}</h2>
      <form.Form aria-label={t("title")} className="flex flex-col gap-4" onChange={() => setSaved(false)}>
        {OWNER_TUNABLE.map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <form.TextField name={key} label={t(`fields.${key}`)} inputMode="numeric" />
            <p className="m-0 text-sm text-fg-muted">{t(key === "taxPeriodSoonDays" ? "hintDays" : "hint", { usual: usual[key], min: bounds[key].min, max: bounds[key].max })}</p>
          </div>
        ))}
        <p className="m-0 text-sm text-fg-muted">{t("evenness")}</p>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        {saved ? <Alert tone="success">{t("saved")}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <form.Submit size="md" disabled={call.pending}>{t("save")}</form.Submit>
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={call.pending}
            onClick={() => {
              void call.run("/api/walker/figures/rules", { method: "PUT", json: { overrides: {} } }).then((result) => {
                if (result !== null) {
                  form.reset(shown(usual, {}));
                  setSaved(true);
                }
              });
            }}
          >
            {t("reset")}
          </Button>
        </div>
      </form.Form>
    </Card.Root>
  );
}
