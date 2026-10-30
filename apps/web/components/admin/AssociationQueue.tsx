"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Field, Input } from "@krizaka/ui/field";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";
import { formatDate } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface PendingAssociation {
  id: string;
  email: string;
  kind: "neq" | "charity" | "incorporation";
  reference: string;
  note: string | null;
  submittedAt: string;
}

/** One proof to check: who sent it, what it is, a reason when refused; approving or refusing is audited and leaves the queue. */
function Proof({ proof }: Readonly<{ proof: PendingAssociation }>) {
  const { say, locale } = useSay();
  const call = useCall();
  const [reason, setReason] = useState("");
  const decide = (decision: "approved" | "rejected") => call.run(`/api/admin/associations/${proof.id}`, { json: { decision, ...(reason ? { note: reason } : {}) } });
  return (
    <Card.Root className="flex flex-col gap-3 p-4" data-testid="association-proof">
      <DescriptionList
        items={[
          { term: say("admin.associations.account"), details: proof.email },
          { term: say("admin.associations.kind"), details: <Badge tone="neutral">{say(`account.subscription.assoKinds.${proof.kind}`)}</Badge> },
          { term: say("admin.associations.reference"), details: <code>{proof.reference}</code> },
          { term: say("admin.associations.submitted"), details: formatDate(proof.submittedAt, locale, "UTC") },
          ...(proof.note ? [{ term: say("account.subscription.assoNote"), details: proof.note }] : []),
        ]}
      />
      <Field.Root>
        <Field.Label htmlFor={`reason-${proof.id}`}>{say("admin.associations.note")}</Field.Label>
        <Input id={`reason-${proof.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field.Root>
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      <div className="flex gap-2">
        <Button size="sm" variant="primary" loading={call.pending} onClick={() => decide("approved")}>
          {say("admin.associations.approve")}
        </Button>
        <Button size="sm" variant="secondary" loading={call.pending} onClick={() => decide("rejected")}>
          {say("admin.associations.reject")}
        </Button>
      </div>
    </Card.Root>
  );
}

/** The administrator's queue of association proofs (ADR-003 addendum 2026-10-30), oldest first. */
export function AssociationQueue({ pending }: Readonly<{ pending: PendingAssociation[] }>) {
  const { say } = useSay();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{say("admin.associations.title")}</h1>
        <p className="max-w-prose text-fg-secondary">{say("admin.associations.lead")}</p>
      </header>
      {pending.length === 0 ? <p className="text-fg-secondary">{say("admin.associations.empty")}</p> : pending.map((proof) => <Proof key={proof.id} proof={proof} />)}
    </div>
  );
}
