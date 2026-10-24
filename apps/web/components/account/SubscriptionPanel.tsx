"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";
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
  offer: { price: string } | null;
}

/** The subscription: its state, the founder offer when it is on sale, and the hosted page where it is managed, its invoices read and it is cancelled. */
export function SubscriptionPanel({ subscription }: { subscription: SubscriptionView }) {
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
      {subscription.hasCustomer ? (
        <SettingsRow label={say("account.subscription.manage")} description={say("account.subscription.manageHint")}>
          <Button size="sm" variant="secondary" loading={open.isPending} onClick={() => open.mutate("portal")}>
            {say("account.subscription.portal")}
          </Button>
        </SettingsRow>
      ) : null}
      {!subscription.active && subscription.offer ? (
        <SettingsRow label={say("account.subscription.founder")} description={say("account.subscription.founderHint", { price: subscription.offer.price })}>
          <Button size="sm" variant="primary" loading={open.isPending} onClick={() => open.mutate("checkout")}>
            {say("account.subscription.choose")}
          </Button>
        </SettingsRow>
      ) : null}
      {!subscription.active && !subscription.offer && !subscription.hasCustomer ? <p className="py-4 text-sm text-fg-secondary">{say("account.subscription.unavailable")}</p> : null}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </SettingsSection>
  );
}
