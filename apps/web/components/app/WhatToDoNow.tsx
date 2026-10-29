import type { NextAction } from "@akinaza/core";
import { Card } from "@krizaka/ui/card";
import { NextActions } from "@krizaka/ui/next-actions";
import Link from "next/link";

import { ButtonLink } from "@/components/ButtonLink";
import { actionView } from "@/lib/figures-view";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { ShopRoutes } from "@/lib/routes";

/**
 * « Que faire maintenant » (#260): the two or three actions built from the shop's own rows, each with its reason and where it leads. The block asks
 * for at least two; one action is a card of its own, and none shows nothing (an empty shop is not given invented work).
 */
export function WhatToDoNow({ actions, locale, routes }: Readonly<{ actions: readonly NextAction[]; locale: Locale; routes: ShopRoutes }>) {
  const t = getDictionary(locale).console.figures;
  const views = actions.map((a) => actionView(a, locale, routes));
  const toBlock = (v: (typeof views)[number]) => ({
    id: v.id,
    title: v.title,
    why: v.why,
    urgency: v.urgency,
    urgencyLabel: v.urgencyLabel,
    action: <ButtonLink href={v.href} variant="secondary" size="sm">{v.cta}</ButtonLink>,
  });
  if (views.length >= 2) {
    const [a, b, c] = views.map(toBlock) as [ReturnType<typeof toBlock>, ReturnType<typeof toBlock>, ReturnType<typeof toBlock>?];
    return <NextActions title={t.nextTitle} actions={c ? [a, b, c] : [a, b]} data-testid="next-actions" />;
  }
  const only = views[0];
  if (!only) return null;
  return (
    <Card.Root data-testid="next-actions">
      <Card.Body>
        <Card.Title as="h2">{t.nextTitle}</Card.Title>
        <p className="font-medium">{only.title}</p>
        <p className="text-sm text-fg-muted">{only.why}</p>
        <div><Link href={only.href} className="text-sm underline underline-offset-2">{only.cta}</Link></div>
      </Card.Body>
    </Card.Root>
  );
}
