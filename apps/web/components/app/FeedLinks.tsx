"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { useState } from "react";

import { FeedAddress } from "@/components/app/FeedAddress";
import { useCall } from "@/components/app/useCall";
import type { FeedOverview, FeedState } from "@/lib/feed-overview";
import { useSay } from "@/lib/i18n-client";

/** One feed: its state, « make / make a new link / turn off », and the address when it has just been made (shown once, never kept). */
function FeedRow({ staffId, name, state }: { staffId: string | null; name: string; state: FeedState }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [url, setUrl] = useState<string | null>(null);
  const t = (key: string, vars?: Record<string, string | number>) => say(`boutique.agenda.feed.${key}`, vars);
  const when = state.createdAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(state.rotatedAt ?? state.createdAt)) : "";
  const id = `feed-${staffId ?? "shop"}`;
  return (
    <li className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words font-semibold text-fg">{name}</span>
        <Badge tone={state.live ? "success" : "neutral"} size="sm">{state.live ? t("live") : t("none")}</Badge>
        {state.live && when ? <span className="text-sm text-fg-muted">{t("since", { when })}</span> : null}
      </div>
      {url ? <FeedAddress id={id} name={name} url={url} /> : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="md"
          variant={state.live ? "secondary" : "primary"}
          disabled={call.pending}
          onClick={async () => {
            const made = await call.run<{ url: string }>("/api/walker/feeds", { json: { staffId } });
            if (made) setUrl(made.url);
          }}
        >
          {state.live ? t("rotate") : t("create")}
        </Button>
        {state.live ? (
          <Button
            type="button"
            size="md"
            variant="ghost"
            disabled={call.pending}
            onClick={async () => {
              if (!window.confirm(t("revokeConfirm"))) return;
              setUrl(null);
              await call.run("/api/walker/feeds", { method: "DELETE", json: { staffId } });
            }}
          >
            {t("revoke")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** « Votre agenda sur votre téléphone » (ADR-004): the private feeds of the shop and of each team member. */
export function FeedLinks({ overview, shopName }: { overview: FeedOverview; shopName: string }) {
  const { say } = useSay();
  const t = (key: string) => say(`boutique.agenda.feed.${key}`);
  if (!overview.enabled) return <Alert tone="info">{t("off")}</Alert>;
  return (
    <div className="flex flex-col gap-4">
      <Card.Root className="flex flex-col gap-4 p-4">
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {overview.shop ? <FeedRow staffId={null} name={`${t("shop")} · ${shopName}`} state={overview.shop} /> : null}
          {overview.people.map((p) => <FeedRow key={p.id} staffId={p.id} name={p.name} state={p} />)}
        </ul>
        {!overview.shop && overview.people.length === 0 ? <p className="m-0 text-fg-secondary">{t("nobody")}</p> : null}
      </Card.Root>
      <Card.Root className="flex flex-col gap-2 p-4">
        <h3 className="font-display text-base font-bold text-fg">{t("howTitle")}</h3>
        <p className="m-0 text-sm text-fg-muted">{t("how")}</p>
      </Card.Root>
    </div>
  );
}
