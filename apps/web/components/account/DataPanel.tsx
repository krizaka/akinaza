"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { ConfirmButton } from "@krizaka/ui/confirm-button";
import { Field, Input } from "@krizaka/ui/field";
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

/** My data (Loi 25): everything the product holds, as one file; and the deletion of the account, confirmed by the password and a second press. */
export function DataPanel({ signInHref }: Readonly<{ signInHref: string }>) {
  const { say } = useSay();
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () => krizakaFetch("/api/me/delete", { method: "POST", json: { password: secret } }),
    onSuccess: () => router.replace(signInHref),
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
    onMutate: () => setProblem(null),
  });
  return (
    <>
      <SettingsSection variant="flat" title={say("account.data.title")} description={say("account.data.description")}>
        <SettingsRow label={say("account.data.export")} description={say("account.data.exportHint")}>
          <Button asChild size="sm" variant="secondary">
            <a href="/api/me/account-export" download>
              {say("account.data.download")}
            </a>
          </Button>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection variant="flat" title={say("account.data.deleteTitle")} description={say("account.data.deleteHint")}>
        <SettingsRow label={say("account.data.confirmPassword")} htmlFor="delete-password">
          <Field.Root>
            <Input id="delete-password" type="password" autoComplete="current-password" value={secret} onChange={(event) => setSecret(event.target.value)} />
          </Field.Root>
        </SettingsRow>
        <SettingsRow label={say("account.data.delete")}>
          <ConfirmButton size="sm" variant="danger" disabled={secret.length === 0} loading={remove.isPending} confirmLabel={say("account.data.deleteConfirm")} onConfirm={() => remove.mutate()}>
            {say("account.data.delete")}
          </ConfirmButton>
        </SettingsRow>
        {problem ? <Alert tone="danger">{problem}</Alert> : null}
      </SettingsSection>
    </>
  );
}
