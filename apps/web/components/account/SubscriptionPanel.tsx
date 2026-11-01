"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Field, Input, Select } from "@krizaka/ui/field";
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";
import Link from "next/link";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface SubscriptionView {
  active: boolean;
  periodEnd: string | null;
  /** The processor knows this account: its hosted page can be opened. */
  hasCustomer: boolean;
  /** The founder offer is on sale, with its price as the processor states it. */
  offer: { price: string; cardRate: string } | null;
  /** The founder offer is complete (its limit is reached) and this account is not a founder: it is no longer offered. */
  offerFull?: boolean;
  /** The price this subscription was sold at (the catalogue's version kept with it): a founder keeps it. */
  soldPrice?: string | null;
  /** The plan this subscription is on (the catalogue entry it was sold at). */
  currentPlan?: "founder" | "starter" | "scale" | "association" | null;
  /** In the free period: the date the first charge happens. */
  trialEndsAt?: string | null;
  /** The plans on sale to an account without a subscription, from the catalogue (price already formatted, free period in whole months or days). */
  plans?: { id: "starter" | "scale" | "association"; price: string; trial: { months: number | null; days: number } | null }[];
  /** The Association plan: the proof state of this account, and whether an administrator approved it. */
  association?: { status: "pending" | "approved" | "rejected" | null; note: string | null };
}

/** The line under the founder offer: choosing it accepts the terms of use. */
function TermsNote() {
  const { say, locale } = useSay();
  return (
    <p className="py-2 text-sm text-fg-secondary" data-testid="terms-accept">
      {say("account.subscription.acceptPrefix")}
      <Link className="underline" href={`/${locale}/terms`}>
        {say("account.subscription.acceptLink")}
      </Link>
      .
    </p>
  );
}

/** The subscription: its state, the founder offer when it is on sale, and the hosted page where it is managed, its invoices read and it is cancelled. */
export function SubscriptionPanel({ subscription }: Readonly<{ subscription: SubscriptionView }>) {
  const { say, locale } = useSay();
  const [problem, setProblem] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: async (kind: "portal" | "founder" | "starter" | "scale" | "association") => {
      const { url } = (await krizakaFetch(kind === "portal" ? "/api/billing/portal" : `/api/billing/checkout?locale=${locale}&plan=${kind}`, { method: "POST" })) as { url: string };
      window.location.assign(url);
    },
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
    onMutate: () => setProblem(null),
  });
  return (
    <SettingsSection variant="flat" title={say("account.subscription.title")} description={say("account.subscription.description")}>
      <SettingsRow label={say("account.subscription.status")}>
        <Badge tone={subscription.active ? "success" : "neutral"}>{say(subscription.active ? "account.subscription.active" : "account.subscription.none")}</Badge>
      </SettingsRow>
      {subscription.active && subscription.periodEnd ? <SettingsRow label={say("account.subscription.renews")}>{formatDate(subscription.periodEnd, locale, "UTC")}</SettingsRow> : null}
      {subscription.trialEndsAt ? <SettingsRow label={say("account.subscription.trialEnds")} description={say("account.subscription.trialEndsHint")}>{formatDate(subscription.trialEndsAt, locale, "UTC")}</SettingsRow> : null}
      {subscription.active && subscription.currentPlan ? <SettingsRow label={say("account.subscription.currentPlan")}>{say(`account.subscription.plan.${subscription.currentPlan}`)}</SettingsRow> : null}
      {subscription.active && subscription.soldPrice ? <SettingsRow label={say("account.subscription.yourPrice")} description={say("account.subscription.yourPriceHint")}>{say("account.subscription.priceLine", { price: subscription.soldPrice })}</SettingsRow> : null}
      {subscription.hasCustomer ? (
        <SettingsRow label={say("account.subscription.manage")} description={say("account.subscription.manageHint")}>
          <Button size="sm" variant="secondary" loading={open.isPending} onClick={() => open.mutate("portal")}>
            {say("account.subscription.portal")}
          </Button>
        </SettingsRow>
      ) : null}
      {subscription.active ? null : <NotSubscribed subscription={subscription} pending={open.isPending} onChoose={(plan) => open.mutate(plan)} onProblem={setProblem} />}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </SettingsSection>
  );
}

/** What an account without a subscription is offered: the founder offer while it is on sale (choosing it accepts the terms), or why there is none. */
function NotSubscribed({ subscription, pending, onChoose, onProblem }: Readonly<{ subscription: SubscriptionView; pending: boolean; onChoose: (plan: "founder" | "starter" | "scale" | "association") => void; onProblem: (message: string | null) => void }>) {
  const { say } = useSay();
  const plans = subscription.plans ?? [];
  const name = { starter: "account.subscription.planStarter", scale: "account.subscription.planScale", association: "account.subscription.planAssociation" } as const;
  return (
    <>
      {plans.filter((plan) => plan.id !== "association").map((plan) => (
        <SettingsRow key={plan.id} label={say(name[plan.id])} description={plan.trial ? say("account.subscription.planHintTrial", { trial: trialText(say, plan.trial), price: plan.price }) : say("account.subscription.planHint", { price: plan.price })}>
          <Button size="sm" variant={plan.id === "starter" ? "primary" : "secondary"} loading={pending} onClick={() => onChoose(plan.id)}>
            {say(plan.trial ? "account.subscription.startTrial" : "account.subscription.choosePlan")}
          </Button>
        </SettingsRow>
      ))}
      {plans.some((plan) => plan.id === "association") ? <AssociationRow subscription={subscription} pending={pending} onChoose={() => onChoose("association")} onProblem={onProblem} /> : null}
      {plans.length ? <TermsNote /> : null}
      {subscription.offer ? (
        <SettingsRow label={say("account.subscription.founder")} description={say("account.subscription.founderHint", { price: subscription.offer.price, cardRate: subscription.offer.cardRate })}>
          <Button size="sm" variant="primary" loading={pending} onClick={() => onChoose("founder")}>
            {say("account.subscription.choose")}
          </Button>
        </SettingsRow>
      ) : null}
      {subscription.offerFull ? <p className="py-4 text-sm text-fg-secondary">{say("account.subscription.offerFull")}</p> : null}
      {!plans.length && !subscription.offer && !subscription.offerFull && !subscription.hasCustomer ? <p className="py-4 text-sm text-fg-secondary">{say("account.subscription.unavailable")}</p> : null}
      {subscription.offer ? <TermsNote /> : null}
    </>
  );
}

const KINDS = ["neq", "charity", "incorporation"] as const;

type Say = ReturnType<typeof useSay>["say"];
const trialText = (say: Say, trial: { months: number | null; days: number } | null): string => {
  if (!trial) {return "";}
  return trial.months ? say("account.subscription.trialMonths", { months: trial.months }) : say("account.subscription.trialDays", { days: trial.days });
};

const rejectionText = (say: Say, status: string | null, note: string | null): string | null => {
  if (status !== "rejected") {return null;}
  return note ? say("account.subscription.assoRejected", { note }) : say("account.subscription.assoRejectedPlain");
};

/**
 * The Association plan: the shop sends one proof (NEQ, registered charity number, incorporation reference); an administrator checks it
 * (`/console/associations`). Until approved the account stays on Starter. Approved, the plan is bought like the others.
 */
function AssociationRow({ subscription, pending, onChoose, onProblem }: Readonly<{ subscription: SubscriptionView; pending: boolean; onChoose: () => void; onProblem: (message: string | null) => void }>) {
  const { say } = useSay();
  const plan = subscription.plans?.find((p) => p.id === "association");
  const status = subscription.association?.status ?? null;
  const [sent, setSent] = useState(false);
  if (!plan) {return null;}
  const rejection = rejectionText(say, status, subscription.association?.note ?? null);
  const trial = trialText(say, plan.trial);
  const pendingNow = status === "pending" || sent;
  return (
    <SettingsRow label={say("account.subscription.associationTitle")} description={say("account.subscription.associationHint", { trial, price: plan.price })}>
      <div className="flex flex-col gap-3" data-testid="association">
        {status === "approved" ? <ApprovedBlock plan={plan} pending={pending} onChoose={onChoose} /> : null}
        {status !== "approved" && pendingNow ? <Badge tone="neutral">{say("account.subscription.assoPending")}</Badge> : null}
        {status !== "approved" && !pendingNow ? <ProofForm rejection={rejection} onProblem={onProblem} onSent={() => setSent(true)} /> : null}
      </div>
    </SettingsRow>
  );
}

type AssociationPlan = NonNullable<SubscriptionView["plans"]>[number];

/** Approved: the plan is bought like the others, with its free months. */
function ApprovedBlock({ plan, pending, onChoose }: Readonly<{ plan: AssociationPlan; pending: boolean; onChoose: () => void }>) {
  const { say } = useSay();
  return (
    <>
      <p className="text-sm text-fg-secondary">{say("account.subscription.assoApproved")}</p>
      <Button size="sm" variant="primary" loading={pending} onClick={onChoose}>
        {say(plan.trial ? "account.subscription.startTrial" : "account.subscription.choosePlan")}
      </Button>
    </>
  );
}

/** The proof's form: what it is, its number or reference, a word for the reviewer. */
function ProofForm({ rejection, onProblem, onSent }: Readonly<{ rejection: string | null; onProblem: (message: string | null) => void; onSent: () => void }>) {
  const { say } = useSay();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("neq");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const submit = useMutation({
    mutationFn: () => krizakaFetch("/api/billing/association", { method: "POST", json: { kind, reference, ...(note ? { note } : {}) } }),
    onMutate: () => onProblem(null),
    onSuccess: onSent,
    onError: (error) => onProblem(say(`errors.${errorKey(error)}`)),
  });
  return (
    <>
      {rejection ? <p className="text-sm text-fg-secondary">{rejection}</p> : null}
      <Field.Root>
        <Field.Label htmlFor="asso-kind">{say("account.subscription.assoKind")}</Field.Label>
        <Select id="asso-kind" value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {say(`account.subscription.assoKinds.${k}`)}
            </option>
          ))}
        </Select>
      </Field.Root>
      <Field.Root>
        <Field.Label htmlFor="asso-reference">{say("account.subscription.assoReference")}</Field.Label>
        <Input id="asso-reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
      </Field.Root>
      <Field.Root>
        <Field.Label htmlFor="asso-note">{say("account.subscription.assoNote")}</Field.Label>
        <Input id="asso-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field.Root>
      <Button size="sm" variant="secondary" loading={submit.isPending} disabled={reference.trim().length === 0} onClick={() => submit.mutate()}>
        {say("account.subscription.assoSubmit")}
      </Button>
    </>
  );
}
