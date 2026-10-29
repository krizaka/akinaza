"use client";

import { CloseIcon } from "@krizaka/icons";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import Link from "next/link";
import { useState } from "react";

import { useSay } from "@/lib/i18n-client";

/**
 * « Le point du lundi » on Today, only when it has something to say (docs/ux/2026-10-full-review.md B2): one line, the way
 * to the full point (`/brief`), and a way to put it aside for this visit. An empty brief shows nothing — the day comes first.
 */
export function BriefBanner({ count, href }: Readonly<{ /** How many facts the brief holds this week; nothing shows for none. */ count: number; href: string }>) {
  const { say } = useSay();
  const [hidden, setHidden] = useState(false);
  if (count === 0 || hidden) return null;
  return (
    <Alert
      tone="info"
      title={say("brief.title")}
      data-testid="brief-banner"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={href}>{say("today.brief.see", { count })}</Link>
          </Button>
          <Button size="sm" variant="ghost" aria-label={say("today.brief.dismiss")} onClick={() => setHidden(true)}>
            <CloseIcon size={16} aria-hidden />
          </Button>
        </div>
      }
    >
      {say("brief.lead")}
    </Alert>
  );
}
