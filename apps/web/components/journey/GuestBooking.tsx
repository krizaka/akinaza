"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Captcha, CaptchaDisclosure } from "@krizaka/ui/captcha";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay, useVocabulary } from "@/lib/i18n-client";

export interface GuestBookingData {
  shop: { name: string; slug: string };
  serviceId: string;
  zoneId: string | null;
  staffId: string | null;
  startsAt: string;
  signInHref: string;
}

/** The public widget's key: empty (local dev, tests) renders no check, and the server then accepts none outside production. */
const CAPTCHA_SITE = process.env.NEXT_PUBLIC_ABUSE_CAPTCHA_SITE_KEY ?? "";

type Say = ReturnType<typeof useSay>["say"];
const i18nOf = (say: Say, locale: string) => ({ t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale });

const detailsForm = createKrizakaForm({
  schema: z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), phone: z.string().trim().min(7).max(40), dependantName: z.string().trim().max(80), consentService: z.boolean(), consentReminders: z.boolean() }),
  defaultValues: { fullName: "", email: "", phone: "", dependantName: "", consentService: false, consentReminders: false },
});
const codeForm = createKrizakaForm({ schema: z.object({ code: z.string().trim().regex(/^\d{6}$/) }), defaultValues: { code: "" } });

/**
 * The last step for a visitor who has no account (krizaka-internal#1909): their details and the consent line, a bot check, then the 6-digit code
 * mailed to them; the right code books and signs them in. Nothing is created before the code comes back.
 */
export function GuestBooking({ data }: Readonly<{ data: GuestBookingData }>) {
  const [held, setHeld] = useState<{ challengeId: string; email: string; ttlMinutes: number } | null>(null);
  return held ? <CodeCard data={data} held={held} onOther={() => setHeld(null)} /> : <DetailsCard data={data} onSent={setHeld} />;
}

function DetailsCard({ data, onSent }: Readonly<{ data: GuestBookingData; onSent: (held: { challengeId: string; email: string; ttlMinutes: number }) => void }>) {
  const { say, locale } = useSay();
  const { dependants } = useVocabulary();
  const call = useCall();
  const [token, setToken] = useState<string | null>(null);
  const [needConsent, setNeedConsent] = useState(false);
  const [needCheck, setNeedCheck] = useState(false);
  const form = detailsForm.useForm({
    i18n: i18nOf(say, locale),
    onSubmit: async (v) => {
      setNeedConsent(!v.consentService);
      setNeedCheck(!!CAPTCHA_SITE && !token);
      if (!v.consentService || (CAPTCHA_SITE && !token)) {
        return;
      }
      const json = { serviceId: data.serviceId, zoneId: data.zoneId, staffId: data.staffId, startsAt: data.startsAt, fullName: v.fullName, email: v.email, phone: v.phone, language: locale, ...(dependants && v.dependantName ? { dependantName: v.dependantName } : {}), consentService: true, consentReminders: v.consentReminders, ...(token ? { captchaToken: token } : {}) };
      const done = await call.run<{ challengeId: string; ttlMinutes: number }>(`/api/shops/${data.shop.slug}/guest/code`, { json }, { refresh: false });
      if (done) onSent({ challengeId: done.challengeId, email: v.email.trim().toLowerCase(), ttlMinutes: done.ttlMinutes });
    },
  });
  return (
    <section className="max-w-2xl rounded-xl border border-border-default bg-surface-1 p-5" aria-labelledby="guest-title">
      <h2 id="guest-title" className="font-display text-xl font-bold text-fg">
        {say("guest.title")}
      </h2>
      <p className="mb-4 text-fg-secondary">{say("guest.lead")}</p>
      <form.Form aria-label={say("guest.title")} className="flex flex-col gap-4">
        <form.TextField name="fullName" label={say("book.fullName")} autoComplete="name" />
        <form.TextField name="email" label={say("guest.email")} hint={say("guest.emailHint")} type="email" autoComplete="email" />
        <form.TextField name="phone" label={say("book.phone")} type="tel" autoComplete="tel" />
        {dependants ? <form.TextField name="dependantName" label={say("book.dogName")} /> : null}
        <form.Checkbox name="consentService" label={say("guest.consentService", { shop: data.shop.name })} />
        <form.Checkbox name="consentReminders" label={say("book.consentReminders")} />
        <p className="m-0 text-sm text-fg-secondary">{say("guest.privacy", { shop: data.shop.name, minutes: 15 })}</p>
        {needConsent ? <Alert tone="danger">{say("errors.CONSENT_REQUIRED")}</Alert> : null}
        <Captcha siteKey={CAPTCHA_SITE} onToken={setToken} locale={locale} />
        {needCheck ? <Alert tone="danger">{say("errors.CAPTCHA_FAILED")}</Alert> : null}
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <form.Submit size="lg" variant="primary" className="w-full sm:w-auto sm:self-start">
          {call.pending ? say("guest.sending") : say("guest.send")}
        </form.Submit>
        {CAPTCHA_SITE ? <CaptchaDisclosure locale={locale} /> : null}
      </form.Form>
      <p className="mb-0 mt-4 text-sm text-fg-secondary">
        {say("guest.haveAccount")}{" "}
        <Link className="font-semibold text-fg-accent underline underline-offset-4" href={data.signInHref}>
          {say("guest.signIn")}
        </Link>
      </p>
    </section>
  );
}

function CodeCard({ data, held, onOther }: Readonly<{ data: GuestBookingData; held: { challengeId: string; email: string; ttlMinutes: number }; onOther: () => void }>) {
  const { say, locale } = useSay();
  const router = useRouter();
  const call = useCall();
  const form = codeForm.useForm({
    i18n: i18nOf(say, locale),
    onSubmit: async (v) => {
      const done = await call.run<{ bookingId: string }>(`/api/shops/${data.shop.slug}/guest/confirm`, { json: { challengeId: held.challengeId, email: held.email, code: v.code } }, { refresh: false });
      if (done) router.push(`/${locale}/s/${data.shop.slug}/service/${data.serviceId}/confirmation?booking=${done.bookingId}`);
    },
  });
  return (
    <section className="max-w-2xl rounded-xl border border-border-default bg-surface-1 p-5" aria-labelledby="guest-code-title">
      <h2 id="guest-code-title" className="font-display text-xl font-bold text-fg">
        {say("guest.codeTitle")}
      </h2>
      <p className="mb-4 text-fg-secondary">{say("guest.codeLead", { email: held.email, minutes: held.ttlMinutes })}</p>
      <form.Form aria-label={say("guest.codeTitle")} className="flex flex-col gap-4">
        <form.TextField name="code" label={say("guest.code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        {call.problem === say("errors.SIGN_IN_REQUIRED") ? (
          <Link className="text-sm font-semibold text-fg-accent underline underline-offset-4" href={data.signInHref}>
            {say("guest.signIn")}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <form.Submit size="lg" variant="primary">
            {call.pending ? say("guest.confirming") : say("guest.confirm")}
          </form.Submit>
          <Button type="button" variant="ghost" size="md" onClick={onOther}>
            {say("guest.useOther")}
          </Button>
        </div>
      </form.Form>
    </section>
  );
}
