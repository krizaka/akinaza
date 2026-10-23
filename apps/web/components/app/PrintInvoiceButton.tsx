"use client";

import { Button } from "@krizaka/ui/button";

import { useSay } from "@/lib/i18n-client";

export function PrintInvoiceButton() {
  const { say } = useSay();
  return <Button variant="secondary" onClick={() => window.print()}>{say("invoicePublic.print")}</Button>;
}
