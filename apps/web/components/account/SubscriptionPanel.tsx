"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
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
    mutationFn: async (kind: "portal" | "checkout") => {
      const { url } = (await krizakaFetch(kind === "portal" ? "/api/billing/portal" : `/api/billing/checkout?locale=${locale}`, { method: "POST" })) as { url: string };
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
      {subscription.active && subscription.soldPrice ? <SettingsRow label={say("account.subscription.yourPrice")} description={say("account.subscription.yourPriceHint")}>{say("account.subscription.priceLine", { price: subscription.soldPrice })}</SettingsRow> : null}
      {subscription.hasCustomer ? (
        <SettingsRow label={say("account.subscription.manage")} description={say("account.subscription.manageHint")}>
          <Button size="sm" variant="secondary" loading={open.isPending} onClick={() => open.mutate("portal")}>
            {say("account.subscription.portal")}
          </Button>
        </SettingsRow>
      ) : null}
      {subscription.active ? null : <NotSubscribed subscription={subscription} pending={open.isPending} onChoose={() => open.mutate("checkout")} />}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </SettingsSection>
  );
}

/** What an account without a subscription is offered: the founder offer while it is on sale (choosing it accepts the terms), or why there is none. */
function NotSubscribed({ subscription, pending, onChoose }: Readonly<{ subscription: SubscriptionView; pending: boolean; onChoose: () => void }>) {
  const { say } = useSay();
  return (
    <>
      {subscription.offer ? (
        <SettingsRow label={say("account.subscription.founder")} description={say("account.subscription.founderHint", { price: subscription.offer.price, cardRate: subscription.offer.cardRate })}>
          <Button size="sm" variant="primary" loading={pending} onClick={onChoose}>
            {say("account.subscription.choose")}
          </Button>
        </SettingsRow>
      ) : null}
      {subscription.offerFull ? <p className="py-4 text-sm text-fg-secondary">{say("account.subscription.offerFull")}</p> : null}
      {!subscription.offer && !subscription.offerFull && !subscription.hasCustomer ? <p className="py-4 text-sm text-fg-secondary">{say("account.subscription.unavailable")}</p> : null}
      {subscription.offer ? <TermsNote /> : null}
    </>
  );
}
