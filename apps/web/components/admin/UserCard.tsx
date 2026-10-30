"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Field, Input } from "@krizaka/ui/field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserDetail } from "@/lib/admin";
import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

import { formatDate } from "./format";

/** One account and what an administrator does to it: suspend or restore, role, sessions, Law 25 export and erasure. */
export function UserCard({ initial, self }: Readonly<{ initial: UserDetail; self: boolean }>) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [user, setUser] = useState(initial);
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fail = (error: unknown) => {
    setNote(null);
    setProblem(say(`errors.${errorKey(error)}`));
  };
  const post = (path: string, init: { method: string; json?: unknown } = { method: "POST" }) => krizakaFetch(`/api/admin/users/${user.id}${path}`, init) as Promise<{ user?: UserDetail; revoked?: number }>;
  const apply = (r: { user?: UserDetail }) => {
    if (r.user) setUser(r.user);
    setProblem(null);
  };
  const status = useMutation({ mutationFn: (to: "suspend" | "restore") => post(`/${to}`), onSuccess: apply, onError: fail });
  const role = useMutation({ mutationFn: () => post("/role", { method: "POST", json: { role: user.role === "ADMIN" ? "USER" : "ADMIN" } }), onSuccess: apply, onError: fail });
  const revoke = useMutation({
    mutationFn: () => post("/sessions", { method: "DELETE" }),
    onSuccess: (r) => {
      apply(r);
      setNote(say("admin.user.sessionsRevoked", { count: r.revoked ?? 0 }));
    },
    onError: fail,
  });
  const erase = useMutation({ mutationFn: () => post("", { method: "DELETE", json: { confirmEmail: confirm } }), onSuccess: () => router.push(`/${locale}/users`), onError: fail });
  return (
    <Card.Root className="flex flex-col gap-4 p-4">
      <Link href={`/${locale}/users`} className="text-sm text-fg-muted hover:text-fg">
        ← {say("admin.user.back")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="break-all font-display text-xl font-extrabold text-fg">{user.email}</h2>
        {!self &&
          (user.status === "ACTIVE" ? (
          <Button variant="secondary" size="sm" loading={status.isPending} onClick={() => status.mutate("suspend")}>
            {say("admin.user.suspend")}
          </Button>
        ) : (
          <Button variant="primary" size="sm" loading={status.isPending} onClick={() => status.mutate("restore")}>
            {say("admin.user.restore")}
          </Button>
        ))}
      </div>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      {note ? <Alert tone="success">{note}</Alert> : null}
      <DescriptionList
        items={[
          { term: say("admin.user.role"), details: <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{say(`admin.roles.${user.role}`)}</Badge> },
          { term: say("admin.user.status"), details: <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{say(`admin.states.${user.status}`)}</Badge> },
          { term: say("admin.user.shops"), details: String(user.shops) },
          { term: say("admin.user.sessions"), details: String(user.sessions) },
          { term: say("admin.user.created"), details: formatDate(user.createdAt, locale, true) },
          { term: say("admin.user.lastSeen"), details: user.lastSeenAt ? formatDate(user.lastSeenAt, locale, true) : say("admin.never") },
        ]}
      />
      {self ? (
        <p className="text-sm text-fg-muted">{say("admin.user.self")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={role.isPending} onClick={() => role.mutate()}>
              {say(user.role === "ADMIN" ? "admin.user.makeUser" : "admin.user.makeAdmin")}
            </Button>
            <Button variant="secondary" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate()}>
              {say("admin.user.revokeSessions")}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a href={`/api/admin/users/${user.id}/export`} download>
                {say("admin.user.exportData")}
              </a>
            </Button>
          </div>
          <section className="flex flex-col gap-2 border-t border-border-subtle pt-4" aria-label={say("admin.user.dangerTitle")}>
            <h3 className="font-display text-sm font-bold text-fg">{say("admin.user.dangerTitle")}</h3>
            <p className="text-sm text-fg-secondary">{say("admin.user.dangerLead")}</p>
            <Field.Root>
              <Field.Label htmlFor="confirm-email">{say("admin.user.confirmLabel")}</Field.Label>
              <Input id="confirm-email" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
            </Field.Root>
            <div>
              <Button variant="danger" size="sm" loading={erase.isPending} disabled={confirm.trim().toLowerCase() !== user.email} onClick={() => erase.mutate()}>
                {say("admin.user.deleteAccount")}
              </Button>
            </div>
          </section>
        </>
      )}
    </Card.Root>
  );
}
