"use client";

import type { Availability, PriceHistoryLine, PricesDescription } from "@krizaka/settings";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Field, Input, Select } from "@krizaka/ui/field";
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";
import { centsFromDollars, formatDate, formatMoney } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

type Entry = PricesDescription["entries"][number];
const ZONE = "America/Toronto";

/**
 * One entry of the catalogue of prices, for the administrator (akinaza#371): the version in force and its limits, what is
 * scheduled, a change from a date (now or later), and the history. Composed from `SettingsSection` / `SettingsRow` until the
 * price-list block of Krizaka UI exists (krizaka/krizaka-ui#713). A subscription already sold keeps its version.
 */
export function PriceEntryAdmin({ entry, history, availabilities }: Readonly<{ entry: Entry; history: PriceHistoryLine[]; availabilities: Availability[] }>) {
  const { say, locale } = useSay();
  const call = useCall();
  const [amount, setAmount] = useState(entry.amountCents === null ? "" : String(entry.amountCents / 100));
  const [availability, setAvailability] = useState<Availability>(entry.availability);
  const [limits, setLimits] = useState<Record<string, string>>(Object.fromEntries(Object.entries(entry.limits).map(([k, v]) => [k, String(v)])));
  const [from, setFrom] = useState("");
  const [saved, setSaved] = useState(false);
  const money = (cents: number | null) => (cents === null ? say("admin.prices.noFigure") : formatMoney(cents, locale));
  const cents = amount.trim() === "" ? null : centsFromDollars(amount);
  const limitValues = Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, Number(v)]));
  const valid = (amount.trim() === "" || cents !== null) && Object.values(limitValues).every((v) => Number.isInteger(v) && v >= 0);
  const schedule = async () => {
    setSaved(false);
    const json = { amountCents: cents, availability, limits: limitValues, ...(from ? { effectiveFrom: new Date(from).toISOString() } : {}) };
    if (await call.run(`/api/admin/prices/${entry.key}`, { method: "POST", json })) setSaved(true);
  };
  const label = say(`admin.prices.plans.${entry.plan}`);
  return (
    <SettingsSection variant="flat" title={label} description={say("admin.prices.entryHint", { key: entry.key, version: entry.versionId })}>
      <SettingsRow label={say("admin.prices.amount")} description={say("admin.prices.plusTaxes")}>
        {say("admin.prices.perUnit", { price: money(entry.amountCents), unit: say(`admin.prices.units.${entry.unit}`) })}
      </SettingsRow>
      <SettingsRow label={say("admin.prices.availability")}>
        <Badge tone={entry.availability === "internal" ? "neutral" : "accent"}>{say(`admin.prices.availabilities.${entry.availability}`)}</Badge>
      </SettingsRow>
      {Object.entries(entry.limits).map(([name, value]) => (
        <SettingsRow key={name} label={say(`admin.prices.limits.${name}`)}>
          <code className="font-mono text-sm">{value}</code>
        </SettingsRow>
      ))}
      {entry.upcoming.map((u) => (
        <SettingsRow key={u.versionId} label={say("admin.prices.upcoming", { date: formatDate(u.effectiveFrom, locale, ZONE) })}>
          {say("admin.prices.perUnit", { price: money(u.amountCents), unit: say(`admin.prices.units.${u.unit}`) })} · {say(`admin.prices.availabilities.${u.availability}`)}
        </SettingsRow>
      ))}
      <div className="flex flex-col gap-4 py-4" aria-label={say("admin.prices.change", { plan: label })} role="group">
        <h3 className="font-display text-base font-bold text-fg">{say("admin.prices.change", { plan: label })}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field.Root>
            <Field.Label htmlFor={`${entry.key}-amount`}>{say("admin.prices.amountInput")}</Field.Label>
            <Input id={`${entry.key}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field.Root>
          <Field.Root>
            <Field.Label htmlFor={`${entry.key}-availability`}>{say("admin.prices.availability")}</Field.Label>
            <Select id={`${entry.key}-availability`} value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
              {availabilities.map((a) => (
                <option key={a} value={a}>
                  {say(`admin.prices.availabilities.${a}`)}
                </option>
              ))}
            </Select>
          </Field.Root>
          {Object.keys(limits).map((name) => (
            <Field.Root key={name}>
              <Field.Label htmlFor={`${entry.key}-${name}`}>{say(`admin.prices.limits.${name}`)}</Field.Label>
              <Input id={`${entry.key}-${name}`} inputMode="numeric" value={limits[name]} onChange={(e) => setLimits({ ...limits, [name]: e.target.value })} />
            </Field.Root>
          ))}
          <Field.Root>
            <Field.Label htmlFor={`${entry.key}-from`}>{say("admin.prices.from")}</Field.Label>
            <Input id={`${entry.key}-from`} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field.Root>
        </div>
        <p className="text-sm text-fg-secondary">{say("admin.prices.keepsHint")}</p>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        {saved ? <Alert tone="success">{say("admin.prices.scheduled")}</Alert> : null}
        <Button variant="primary" size="md" className="self-start" disabled={call.pending || !valid} onClick={schedule}>
          {say("admin.prices.schedule")}
        </Button>
      </div>
      <SettingsRow label={say("admin.prices.history")}>
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-fg-secondary">
          {history.map((line) => (
            <li key={line.versionId}>
              {line.before === null
                ? say("admin.prices.seedLine", { price: money(line.after.amountCents) })
                : say("admin.prices.historyLine", { at: formatDate(line.at, locale, ZONE), actor: line.actorLabel, from: formatDate(line.effectiveFrom, locale, ZONE), before: money(line.before.amountCents), after: money(line.after.amountCents) })}
            </li>
          ))}
        </ol>
      </SettingsRow>
    </SettingsSection>
  );
}
