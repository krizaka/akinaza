"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { AccountProfileCard, AvatarPicker } from "@krizaka/ui/account-settings";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Field, Input } from "@krizaka/ui/field";
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";
import { useState } from "react";

import { AVATAR_TONES, avatarChoice, avatarOf } from "@/lib/avatar";
import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

import { useSectionDraft } from "./useSectionDraft";

export interface ProfileView {
  id: string;
  email: string;
  name: string | null;
  avatarSeed: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  /** « Member since October 2026 », formatted on the server in the viewer's language. */
  memberSince: string;
}

const patchProfile = (body: Record<string, unknown>) => krizakaFetch("/api/me/profile", { method: "PATCH", json: body }).then(() => undefined);

/** Changing the address sends a link to the new one: nothing changes until it is opened. */
function EmailChange({ pending }: { pending: string | null }) {
  const { say } = useSay();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(pending);
  const [problem, setProblem] = useState<string | null>(null);
  const request = useMutation({ mutationFn: () => krizakaFetch("/api/me/email", { method: "POST", json: { newEmail: email, password: secret } }) });
  if (!open) {
    return (
      <div className="flex flex-col items-end gap-2">
        {sentTo ? <p className="text-sm text-fg-secondary">{say("account.email.pending", { email: sentTo })}</p> : null}
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {say("account.email.change")}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex w-full flex-col gap-3 sm:max-w-sm"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setProblem(null);
        try {
          await request.mutateAsync();
          setSentTo(email);
          setOpen(false);
          setSecret("");
        } catch (error) {
          setProblem(say(`errors.${errorKey(error)}`));
        }
      }}
    >
      <Field.Root>
        <Field.Label htmlFor="new-email">{say("account.email.new")}</Field.Label>
        <Input id="new-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field.Root>
      <Field.Root>
        <Field.Label htmlFor="email-password">{say("account.email.password")}</Field.Label>
        <Input id="email-password" type="password" autoComplete="current-password" value={secret} onChange={(event) => setSecret(event.target.value)} />
      </Field.Root>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={request.isPending}>
          {say("account.email.send")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {say("account.email.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** The profile: who you are (name, picture) and the address, each with its own place; one save for the name and the picture. */
export function ProfileSettings({ profile }: { profile: ProfileView }) {
  const { say } = useSay();
  const form = useSectionDraft({ name: profile.name ?? "", avatar: avatarChoice(profile) }, (values) => patchProfile({ name: values.name.trim() || null, avatarSeed: values.avatar }));
  const shown = { id: profile.id, avatarSeed: form.draft.avatar };
  return (
    <SettingsSection variant="flat" title={say("account.profile.sections.profile")} description={say("account.profile.description")} save={form.save}>
      <SettingsRow
        label={
          <AccountProfileCard
            compact
            name={form.draft.name || profile.email}
            email={profile.email}
            verified={profile.emailVerified}
            verifiedLabel={say("account.email.verified")}
            unverifiedLabel={say("account.email.unverified")}
            memberSince={profile.memberSince}
            avatar={{ defaultAvatar: avatarOf(shown) }}
          />
        }
      />
      <SettingsRow label={say("account.name.label")} description={say("account.name.hint")} htmlFor="account-name">
        <Input id="account-name" value={form.draft.name} maxLength={80} autoComplete="name" onChange={(event) => form.set({ name: event.target.value })} />
      </SettingsRow>
      <SettingsRow label={say("account.avatar.label")} description={say("account.avatar.hint")}>
        <AvatarPicker
          dense
          label={say("account.avatar.label")}
          options={AVATAR_TONES.map((tone) => ({ id: String(tone), label: say("account.avatar.tone", { tone }), defaultAvatar: { brand: "akinaza", tone } }))}
          value={form.draft.avatar}
          onValueChange={(avatar) => form.set({ avatar })}
        />
      </SettingsRow>
      <SettingsRow label={say("account.email.label")} description={say("account.email.hint")}>
        <EmailChange pending={profile.pendingEmail} />
      </SettingsRow>
    </SettingsSection>
  );
}
