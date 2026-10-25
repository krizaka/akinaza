"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { ConfirmButton } from "@krizaka/ui/confirm-button";
import { SettingsSection } from "@krizaka/ui/settings-layout";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface SessionView {
  id: string;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

/** The sign-ins of the account: where from and since when, this one flagged; one action ends all the others. */
export function SessionsPanel({ sessions }: { sessions: SessionView[] }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current).length;
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/me/sessions/sign-out-others", { method: "POST" }),
    onSuccess: () => router.refresh(),
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
    onMutate: () => setProblem(null),
  });
  return (
    <SettingsSection
      variant="flat"
      title={say("account.sessions.title")}
      description={say("account.sessions.description")}
      footer={
        others > 0 ? (
          <ConfirmButton size="sm" variant="secondary" loading={signOut.isPending} confirmLabel={say("account.sessions.confirm")} onConfirm={() => signOut.mutate()}>
            {say("account.sessions.signOutOthers", { count: others })}
          </ConfirmButton>
        ) : null
      }
    >
      <ul className="flex flex-col divide-y divide-border-subtle">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-fg">{s.userAgent ?? say("account.sessions.unknownDevice")}</span>
              <span className="text-xs text-fg-secondary">{[s.ip, say("account.sessions.since", { date: formatDate(s.createdAt, locale, "UTC") })].filter(Boolean).join(" · ")}</span>
            </span>
            {s.current ? <Badge tone="success">{say("account.sessions.thisOne")}</Badge> : null}
          </li>
        ))}
      </ul>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </SettingsSection>
  );
}
