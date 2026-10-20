"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

/** The three account forms on @krizaka/ui's form: each one posts to its route and says what the server answered. */

const forgot = createKrizakaForm({ schema: z.object({ email: z.string().trim().min(1).email() }), defaultValues: { email: "" } });

export function ForgotForm() {
  const { say, locale } = useSay();
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const request = useMutation({ mutationFn: (body: { email: string }) => krizakaFetch("/api/auth/password/forgot", { method: "POST", json: body }) });
  const form = forgot.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        await request.mutateAsync(values);
        setSent(true);
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  if (sent) return <Alert tone="success">{say("account.forgot.sent")}</Alert>;
  return (
    <form.Form aria-label={say("account.forgot.title")} className="flex flex-col gap-4">
      <form.TextField name="email" label={say("account.forgot.email")} type="email" autoComplete="username" />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit size="lg" className="w-full">
        {say("account.forgot.submit")}
      </form.Submit>
    </form.Form>
  );
}

const reset = createKrizakaForm({ schema: z.object({ password: z.string().min(1).max(256) }), defaultValues: { password: "" } });

export function ResetForm({ token, signInHref }: { token: string; signInHref: string }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const request = useMutation({ mutationFn: (body: { token: string; password: string }) => krizakaFetch("/api/auth/password/reset", { method: "POST", json: body }) });
  const form = reset.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        await request.mutateAsync({ token, password: values.password });
        setDone(true);
        router.refresh();
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  if (done) return <Alert tone="success">{say("account.reset.done")}</Alert>;
  return (
    <form.Form aria-label={say("account.reset.title")} className="flex flex-col gap-4">
      <p className="text-sm text-fg-secondary">{say("account.reset.description")}</p>
      <form.TextField name="password" label={say("account.reset.password")} type="password" autoComplete="new-password" />
      {problem ? (
        <Alert tone="danger">
          {problem} <Link className="underline" href={signInHref}>{say("account.reset.askAgain")}</Link>
        </Alert>
      ) : null}
      <form.Submit size="lg" className="w-full">
        {say("account.reset.submit")}
      </form.Submit>
    </form.Form>
  );
}

const change = createKrizakaForm({
  schema: z.object({ current: z.string().min(1).max(256), password: z.string().min(1).max(256) }),
  defaultValues: { current: "", password: "" },
});

export function ChangePasswordForm() {
  const { say, locale } = useSay();
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const request = useMutation({ mutationFn: (body: { current: string; password: string }) => krizakaFetch("/api/auth/password/change", { method: "POST", json: body }) });
  const form = change.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      setSaved(false);
      try {
        await request.mutateAsync(values);
        setSaved(true);
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  return (
    <form.Form aria-label={say("account.profile.passwordTitle")} className="flex flex-col gap-4">
      <form.TextField name="current" label={say("account.profile.current")} type="password" autoComplete="current-password" />
      <form.TextField name="password" label={say("account.profile.next")} type="password" autoComplete="new-password" />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      {saved ? <Alert tone="success">{say("account.profile.saved")}</Alert> : null}
      <form.Submit size="md">
        {say("account.profile.submit")}
      </form.Submit>
    </form.Form>
  );
}
