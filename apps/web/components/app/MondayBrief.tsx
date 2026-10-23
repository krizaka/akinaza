"use client";

import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import Link from "next/link";
import { useState } from "react";

import { useShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { formatMoney } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface BriefCard {
  id: string;
  kind: "gaps" | "pricing" | "taxes";
  subject: string;
  figures: Record<string, number>;
  assumptions: string[];
}

/** What an invitation did, as the server recorded it (missing counts are zero). */
type Result = Partial<Record<"sent" | "pending" | "failed" | "skipped", number>>;

/**
 * « Le point du lundi » (its own page, `/brief`): at most three cards, each one fact, one figure, one button — readable in five
 * seconds. The figures are the shop's own (its appointments, its invoices), the assumption written under them; nothing is sent
 * without a press. Today announces it with `BriefBanner`.
 */
export function MondayBrief({ items, done, services, publicPage }: { items: BriefCard[]; done: Record<string, Result>; services: Record<string, { fr: string; en: string }>; publicPage: boolean }) {
  const { say, locale } = useSay();
  const money = (cents: number) => formatMoney(cents, locale);
  return (
    <section aria-label={say("brief.title")} className="flex flex-col gap-3">
      {items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex">
              <BriefItem item={item} done={done[item.id] ?? null} serviceName={services[item.subject]?.[locale] ?? ""} publicPage={publicPage} money={money} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BriefItem({ item, done, serviceName, publicPage, money }: { item: BriefCard; done: Result | null; serviceName: string; publicPage: boolean; money: (c: number) => string }) {
  const { say } = useSay();
  const routes = useShopRoutes();
  const f = item.figures;
  const text = {
    gaps: { title: say("brief.gaps.title", { slots: f.freeSlots ?? 0 }), figure: money(f.missedCents ?? 0), line: say("brief.gaps.line", { invitees: f.invitees ?? 0, weeks: Math.round((f.dormantDays ?? 42) / 7) }) },
    pricing: { title: say("brief.pricing.title", { service: serviceName, time: f.timeSharePct ?? 0, revenue: f.revenueSharePct ?? 0 }), figure: `+${money(f.monthlyGainCents ?? 0)}`, line: say("brief.pricing.line", { suggested: money(f.suggestedCents ?? 0), current: money(f.currentCents ?? 0) }) },
    taxes: { title: say("brief.taxes.title"), figure: money(f.setAsideCents ?? 0), line: say("brief.taxes.line", { invoiced: money(f.invoicedCents ?? 0), credits: money(f.creditsCents ?? 0), available: money(f.availableCents ?? 0) }) },
  }[item.kind];
  return (
    <Card.Root className="w-full">
      <Card.Body>
        <Card.Title as="h3" className="line-clamp-2">
          {text.title}
        </Card.Title>
        <Card.Stat label={say(`brief.${item.kind}.figure`)}>{text.figure}</Card.Stat>
        <p className="text-xs text-fg-secondary">{text.line}</p>
        {item.assumptions.map((a) => (
          <p key={a} className="text-xs text-fg-tertiary">
            {say(`brief.assumptions.${a}`)}
          </p>
        ))}
        <Card.Footer>
          {item.kind === "gaps" ? <InviteButton id={item.id} invitees={f.invitees ?? 0} done={done} publicPage={publicPage} /> : null}
          {item.kind === "pricing" ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={routes.setup}>{say("brief.pricing.action")}</Link>
            </Button>
          ) : null}
          {item.kind === "taxes" ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={routes.books()}>{say("brief.taxes.action")}</Link>
            </Button>
          ) : null}
        </Card.Footer>
      </Card.Body>
    </Card.Root>
  );
}

function InviteButton({ id, invitees, done, publicPage }: { id: string; invitees: number; done: Result | null; publicPage: boolean }) {
  const { say } = useSay();
  const { run, pending, problem } = useCall();
  const [result, setResult] = useState<Result | null>(done);
  if (result)
    return (
      <p role="status" className="text-sm text-fg">
        {say("brief.gaps.done", { sent: (result.sent ?? 0) + (result.pending ?? 0) })}
        {result.skipped ? ` ${say("brief.gaps.doneSkipped", { skipped: result.skipped })}` : null}
      </p>
    );
  if (!publicPage) return <p className="text-sm text-fg-secondary">{say("brief.gaps.notPublic")}</p>;
  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant="primary" disabled={pending} onClick={async () => setResult((await run<Result>("/api/walker/brief/invite", { json: { id } })) ?? null)}>
        {say("brief.gaps.action", { invitees })}
      </Button>
      {problem ? <p role="alert" className="text-xs text-danger">{problem}</p> : null}
    </div>
  );
}
