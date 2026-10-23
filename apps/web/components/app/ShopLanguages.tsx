"use client";

import type { PageLocale } from "@akinaza/db";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Field, Select, Textarea } from "@krizaka/ui/field";
import { PageHeader } from "@krizaka/ui/page-header";
import { Switch } from "@krizaka/ui/switch";
import Link from "next/link";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import type { FieldView, TranslationState } from "@/lib/translation-rows";

export interface LanguagesData {
  source: "fr" | "en";
  enabled: PageLocale[];
  allowed: PageLocale[];
  translationOn: boolean;
  dailyLimit: number;
  usedToday: number;
  fields: FieldView[];
  setupHref: string;
}

const TONE: Record<TranslationState, "neutral" | "success" | "warning" | "accent"> = { own: "neutral", missing: "neutral", auto: "accent", edited: "success", stale: "warning" };

/** One text in one language: what the page will say, its state, the owner's own wording, and « refaire la traduction ». */
function TextRow({ field, locale, translationOn }: { field: FieldView; locale: PageLocale; translationOn: boolean }) {
  const { say } = useSay();
  const call = useCall();
  const current = field.languages[locale] ?? { state: "missing" as const, text: "" };
  const [text, setText] = useState(current.text);
  const t = (key: string) => say(`shopLanguages.${key}`);
  const writable = current.state !== "own";
  const label = `${t(`fields.${field.field}`)}${field.owner ? ` · ${field.owner}` : ""}`;
  return (
    <li className="flex flex-col gap-2 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-fg">{label}</span>
        <Badge tone={TONE[current.state]} size="sm">{t(`state.${current.state}`)}</Badge>
      </div>
      <p className="m-0 whitespace-pre-line text-sm text-fg-muted">{field.source}</p>
      <Field.Root>
        <Field.Label htmlFor={`${field.key}-${locale}`} className="sr-only">{label}</Field.Label>
        <Textarea id={`${field.key}-${locale}`} rows={field.field === "bio" ? 4 : 2} maxLength={2000} value={text} readOnly={!writable} onChange={(e) => setText(e.target.value)} />
        {current.state === "own" ? <Field.Hint>{t("ownHint")}</Field.Hint> : null}
        {current.state === "stale" ? <Field.Hint>{t("staleHint")}</Field.Hint> : null}
      </Field.Root>
      {writable ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={call.pending || !text.trim() || text === current.text} onClick={() => void call.run("/api/walker/translations/text", { method: "PUT", json: { locale, key: field.key, text } })}>
            {t("save")}
          </Button>
          {translationOn ? (
            <Button size="sm" variant="ghost" disabled={call.pending} onClick={() => void call.run("/api/walker/translations/run", { json: { locale, redo: [field.key] } })}>
              {t(current.text ? "redo" : "translateOne")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
    </li>
  );
}

/** The shop page in other languages: which ones are on, and each text in each of them, editable (#258). Plain words: « traduction automatique », never more. */
export function ShopLanguages({ data }: { data: LanguagesData }) {
  const { say, locale: uiLocale } = useSay();
  const call = useCall();
  const t = (key: string, vars?: Record<string, string | number>) => say(`shopLanguages.${key}`, vars);
  const [source, setSource] = useState<"fr" | "en">(data.source);
  const [enabled, setEnabled] = useState<PageLocale[]>(data.enabled);
  const name = (l: PageLocale) => new Intl.DisplayNames([uiLocale], { type: "language" }).of(l) ?? l;
  const offered = (["fr", "en", "es"] as const).filter((l) => l === source || data.allowed.includes(l) || enabled.includes(l));
  const toggle = (l: PageLocale, on: boolean) => setEnabled((current) => (on ? [...new Set([...current, l])] : current.filter((x) => x !== l)));
  const targets = data.enabled.filter((l) => l !== data.source);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("intro")} />
      <p className="text-sm"><Link className="font-semibold text-fg-accent underline" href={data.setupHref}>{t("back")}</Link></p>

      <Card.Root className="flex flex-col gap-4 p-4">
        <h2 className="font-display text-lg font-bold text-fg">{t("languages")}</h2>
        <Field.Root>
          <Field.Label htmlFor="source-locale">{t("source")}</Field.Label>
          <Select id="source-locale" value={source} onChange={(e) => { const next = e.target.value as "fr" | "en"; setSource(next); setEnabled((current) => [...new Set([...current, next])]); }}>
            <option value="fr">{name("fr")}</option>
            <option value="en">{name("en")}</option>
          </Select>
          <Field.Hint>{t("sourceHint")}</Field.Hint>
        </Field.Root>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {offered.map((l) => (
            <li key={l} className="flex items-center justify-between gap-3">
              <span className="text-fg">{name(l)}</span>
              {l === source ? <Badge tone="neutral" size="sm">{t("sourceBadge")}</Badge> : <Switch checked={enabled.includes(l)} onCheckedChange={(on) => toggle(l, on)} label={t("offer", { language: name(l) })} />}
            </li>
          ))}
        </ul>
        <p className="m-0 text-sm text-fg-muted">{t("allowedHint")}</p>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <div>
          <Button size="md" disabled={call.pending} onClick={() => void call.run("/api/walker/translations", { method: "PUT", json: { source, enabled } })}>{t("saveLanguages")}</Button>
        </div>
      </Card.Root>

      {!data.translationOn ? <Alert tone="info">{t("unavailable")}</Alert> : null}

      {targets.map((l) => (
        <Card.Root key={l} className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-fg">{name(l)}</h2>
            {data.translationOn ? <TranslateButton locale={l} label={t("translate")} /> : null}
          </div>
          <p className="m-0 text-sm text-fg-muted">{t("autoMark")}</p>
          {data.translationOn ? <p className="m-0 text-xs text-fg-muted">{t("runs", { used: data.usedToday, limit: data.dailyLimit })}</p> : null}
          {data.fields.length ? (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {data.fields.map((f) => <TextRow key={`${f.key}-${l}`} field={f} locale={l} translationOn={data.translationOn} />)}
            </ul>
          ) : (
            <p className="m-0 text-fg-secondary">{t("nothing")}</p>
          )}
        </Card.Root>
      ))}
    </div>
  );
}

function TranslateButton({ locale, label }: { locale: PageLocale; label: string }) {
  const call = useCall();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="md" disabled={call.pending} loading={call.pending} onClick={() => void call.run("/api/walker/translations/run", { json: { locale } })}>{label}</Button>
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
    </div>
  );
}
