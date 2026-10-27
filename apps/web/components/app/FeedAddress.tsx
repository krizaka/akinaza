"use client";

import { Button } from "@krizaka/ui/button";
import { Field, Input } from "@krizaka/ui/field";
import { QrCode } from "@krizaka/ui/qr-code";
import { useState } from "react";

import { useSay } from "@/lib/i18n-client";

/**
 * The private address of a calendar feed, right after it was made (#282): the link with « Copy the link », and the same address as a QR
 * code the phone scans. Both live in this component's props only: nothing here stores, sends or logs the address.
 */
export function FeedAddress({ id, name, url }: Readonly<{ id: string; name: string; url: string }>) {
  const { say } = useSay();
  const t = (key: string, vars?: Record<string, string | number>) => say(`boutique.agenda.feed.${key}`, vars);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Field.Root className="min-w-0 flex-1 basis-64">
        <Field.Label htmlFor={id}>{t("url", { name })}</Field.Label>
        <div className="flex flex-wrap gap-2">
          <Input id={id} readOnly value={url} className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            size="md"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
            }}
          >
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
        <Field.Hint>{t("once")}</Field.Hint>
      </Field.Root>
      <QrCode value={url} label={t("qrLabel", { name })} level="Q" size={176} />
    </div>
  );
}
