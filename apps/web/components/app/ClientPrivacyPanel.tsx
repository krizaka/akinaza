"use client";

import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { AlertDialog } from "@krizaka/ui/dialog";

import { useOptionalShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

/** The shop answers a client's access or erasure request (Loi 25, akinaza#370): the owner only. The export is one download; the erasure asks first. */
export function ClientPrivacyPanel({ clientId }: { clientId: string }) {
  const { say } = useSay();
  const call = useCall();
  const routes = useOptionalShopRoutes();
  const exportPath = `/api/walker/clients/${clientId}/export`;
  return (
    <Card.Root className="p-4">
      <h3 className="mb-1 font-display text-base font-bold text-fg">{say("clients.privacy.title")}</h3>
      <p className="mb-3 text-sm text-fg-secondary">{say("clients.privacy.lead")}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={routes ? routes.api(exportPath) : exportPath} download>
            {say("clients.privacy.export")}
          </a>
        </Button>
        <AlertDialog
          trigger={
            <Button size="sm" variant="danger">
              {say("clients.privacy.erase")}
            </Button>
          }
          title={say("clients.privacy.eraseConfirm")}
          description={say("clients.privacy.eraseDescription")}
          confirmLabel={say("clients.privacy.eraseYes")}
          cancelLabel={say("clients.privacy.keep")}
          tone="danger"
          onConfirm={() => call.run(`/api/walker/clients/${clientId}/erase`, { json: { confirm: true } })}
        />
      </div>
    </Card.Root>
  );
}
