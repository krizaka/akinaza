"use client";

import type { ShopRole } from "@akinaza/db";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { ConfirmButton } from "@krizaka/ui/confirm-button";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { Select } from "@krizaka/ui/field";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";

import { ClientAvatar } from "@/components/app/ClientsTable";
import { useShopRoutes } from "@/components/app/ShopSession";
import { errorKey } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface TeamMemberView {
  accountId: string;
  email: string;
  name: string | null;
  role: ShopRole;
  since: string;
  /** The person looking may change this member's role and remove them (the role table's `manages`). */
  manageable: boolean;
  isYou: boolean;
}

export interface InvitationView {
  id: string;
  email: string;
  role: ShopRole;
  expiresAt: string;
}

export interface TeamPanelProps {
  members: TeamMemberView[];
  invitations: InvitationView[];
  /** The roles the person looking may hand out. */
  assignable: ShopRole[];
  timeZone: string;
}

/** One call to the team routes: the page is read again after it, and a refusal is said in words. */
function useTeamCall() {
  const { say } = useSay();
  const router = useRouter();
  const routes = useShopRoutes();
  const [problem, setProblem] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: ({ path, method, json }: { path: string; method: "POST" | "PATCH" | "DELETE"; json?: unknown }) => krizakaFetch(routes.api(path), { method, ...(json === undefined ? {} : { json }) }),
    onSuccess: () => router.refresh(),
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
    onMutate: () => setProblem(null),
  });
  return { run: request.mutateAsync, pending: request.isPending, problem };
}

const invite = createKrizakaForm({ schema: z.object({ email: z.string().trim().min(1).email().max(320), role: z.string().min(1) }), defaultValues: { email: "", role: "staff" } });

function InviteForm({ assignable }: { assignable: ShopRole[] }) {
  const { say, locale } = useSay();
  const call = useTeamCall();
  const [link, setLink] = useState<string | null>(null);
  const form = invite.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setLink(null);
      const answer = (await call.run({ path: "/api/walker/team/invitations", method: "POST", json: values }).catch(() => null)) as { link: string } | null;
      if (answer) {
        setLink(answer.link);
        form.reset();
      }
    },
  });
  return (
    <form.Form aria-label={say("team.invite.title")} className="flex flex-col gap-4">
      <form.TextField name="email" label={say("team.invite.email")} type="email" autoComplete="off" />
      <form.RadioGroup name="role" label={say("team.invite.role")} variant="cards" options={assignable.map((role) => ({ value: role, label: say(`team.roles.${role}`), description: say(`team.roleHints.${role}`) }))} />
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {link ? (
        <Alert tone="success">
          {say("team.invite.sent")} <code className="break-all font-mono text-xs">{link}</code>
        </Alert>
      ) : null}
      <form.Submit size="md">{say("team.invite.submit")}</form.Submit>
    </form.Form>
  );
}

/** The team of a shop: who works in it with which role, who is invited, and the form to invite. Owner and manager; the roles one may hand out come from the role table. */
export function TeamPanel({ members, invitations, assignable, timeZone }: TeamPanelProps) {
  const { say, locale } = useSay();
  const call = useTeamCall();
  const columns = useMemo<DataTableColumn<TeamMemberView>[]>(
    () => [
      {
        id: "member",
        header: say("team.columns.member"),
        type: "title",
        card: "title",
        sortable: true,
        value: (m) => m.name ?? m.email,
        subtitle: (m) => (m.name ? m.email : ""),
        cell: (m) => (
          <span className="flex items-center gap-3 font-semibold text-fg">
            <ClientAvatar id={m.accountId} name={m.name ?? m.email} />
            {m.name ?? m.email}
            {m.isYou ? <Badge tone="neutral">{say("team.you")}</Badge> : null}
          </span>
        ),
      },
      {
        id: "role",
        header: say("team.columns.role"),
        sortable: true,
        value: (m) => m.role,
        cell: (m) =>
          m.manageable && !m.isYou ? (
            <Select aria-label={say("team.changeRole", { name: m.name ?? m.email })} value={m.role} disabled={call.pending} onChange={(event) => void call.run({ path: `/api/walker/team/members/${m.accountId}`, method: "PATCH", json: { role: event.target.value } }).catch(() => undefined)}>
              {assignable.map((role) => (
                <option key={role} value={role}>
                  {say(`team.roles.${role}`)}
                </option>
              ))}
            </Select>
          ) : (
            <Badge tone="accent">{say(`team.roles.${m.role}`)}</Badge>
          ),
      },
      { id: "since", header: say("team.columns.since"), priority: 2, value: (m) => m.since, cell: (m) => formatDate(m.since, locale, timeZone) },
      {
        id: "actions",
        header: say("team.columns.actions"),
        headerHidden: true,
        hideable: false,
        align: "end",
        value: () => "",
        cell: (m) =>
          m.manageable && !m.isYou ? (
            <ConfirmButton size="sm" variant="ghost" confirmLabel={say("team.removeConfirm")} onConfirm={() => void call.run({ path: `/api/walker/team/members/${m.accountId}`, method: "DELETE" }).catch(() => undefined)}>
              {say("team.remove")}
            </ConfirmButton>
          ) : null,
      },
    ],
    [say, locale, timeZone, assignable, call],
  );
  return (
    <div className="flex flex-col gap-8">
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      <section aria-labelledby="team-members" className="flex flex-col gap-3">
        <h2 id="team-members" className="sr-only">
          {say("team.members")}
        </h2>
        <DataTable caption={say("team.members")} rows={members} columns={columns} getRowId={(m) => m.accountId} rowLabel={(m) => m.name ?? m.email} />
      </section>

      <section aria-labelledby="team-invitations" className="flex flex-col gap-3">
        <h2 id="team-invitations" className="font-display text-lg font-bold text-fg">
          {say("team.invitations")}
        </h2>
        {invitations.length === 0 ? (
          <p className="text-fg-secondary">{say("team.noInvitations")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-default bg-surface-1">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-fg">{i.email}</span>
                  <span className="text-xs text-fg-secondary">{say("team.expires", { date: formatDate(i.expiresAt, locale, timeZone) })}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="neutral">{say(`team.roles.${i.role}`)}</Badge>
                  <ConfirmButton size="sm" variant="ghost" confirmLabel={say("team.revokeConfirm")} onConfirm={() => void call.run({ path: `/api/walker/team/invitations/${i.id}`, method: "DELETE" }).catch(() => undefined)}>
                    {say("team.revoke")}
                  </ConfirmButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="team-invite" className="flex max-w-xl flex-col gap-3">
        <h2 id="team-invite" className="font-display text-lg font-bold text-fg">
          {say("team.invite.title")}
        </h2>
        <InviteForm assignable={assignable} />
      </section>
    </div>
  );
}
