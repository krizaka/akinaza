"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";

import { useSay } from "@/lib/i18n-client";

/**
 * A page of the signed-in space that failed to load (Today, Clients, Invoices, Books... or the shop layout above them): the settle pattern. A calm sentence and
 * one action; the error's own words (message, digest, stack) never reach the screen.
 */
export function PageError({ reset }: { reset: () => void }) {
  const { say } = useSay();
  return (
    <div role="alert" className="flex flex-col gap-4">
      <Alert tone="danger" title={say("states.page.title")} action={<Button size="sm" variant="secondary" onClick={reset}>{say("states.retry")}</Button>}>
        {say("states.page.body")}
      </Alert>
    </div>
  );
}
