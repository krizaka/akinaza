"use client";

import { Button } from "@krizaka/ui/button";

import { useSay } from "@/lib/i18n-client";

/** Prints the page (or saves it as a PDF): the client's public page says so in full, the owner's invoice says « Imprimer ». */
export function PrintInvoiceButton({ label }: { label?: string } = {}) {
  const { say } = useSay();
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      {label ?? say("invoicePublic.print")}
    </Button>
  );
}
