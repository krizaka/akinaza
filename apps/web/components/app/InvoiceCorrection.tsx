"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { useShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { parseQuantity, QUANTITY_FIELD } from "@/lib/quantity";

type Category = "standard" | "zeroRated" | "exempt";
export interface CorrectionLine {
  description: string;
  quantity: string;
  unitPriceCents: number;
  category: Category;
}

const line = z.object({ description: z.string().trim().max(200), quantity: QUANTITY_FIELD, unitPriceCents: z.number().int().min(0), category: z.enum(["standard", "zeroRated", "exempt"]) });
const correctionForm = createKrizakaForm({ schema: z.object({ lines: z.array(line).min(1).max(40) }), defaultValues: { lines: [] as CorrectionLine[] } });

/**
 * « Modifier la facture » (#207): the original's lines, editable — change a price, a quantity, a description, add or remove a
 * line. Confirming issues the credit note of the original and the replacement together (the server's one transaction), then
 * opens the replacement. The client, the language and the terms stay the original's.
 */
export function InvoiceCorrection({ original, lines, today }: { original: { id: string; number: string; clientId: string | null; language: "fr" | "en"; termsDays: number | null }; lines: CorrectionLine[]; today: string }) {
  const { say, locale } = useSay();
  const call = useCall();
  const router = useRouter();
  const routes = useShopRoutes();
  const [needLine, setNeedLine] = useState(false);
  const form = correctionForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: { lines },
    onSubmit: async (values) => {
      const kept = values.lines.flatMap((l) => {
        const quantity = parseQuantity(l.quantity);
        return l.description.trim() && quantity !== null ? [{ description: l.description.trim(), quantity, unitPriceCents: l.unitPriceCents, category: l.category }] : [];
      });
      setNeedLine(kept.length === 0);
      if (kept.length === 0) return;
      const done = await call.run<{ id: string }>(
        `/api/walker/invoices/${original.id}/replace`,
        { json: { clientId: original.clientId, language: original.language, issuedOn: today, ...(original.termsDays === null ? {} : { termsDays: original.termsDays }), lines: kept } },
        { refresh: false },
      );
      if (done !== null) router.push(routes.invoice(done.id));
    },
  });
  return (
    <Card.Root className="p-4">
      <h2 className="font-display text-base font-bold text-fg">{say("invoices.correct.title", { number: original.number })}</h2>
      <p className="mb-4 mt-1 text-sm text-fg-secondary">{say("invoices.correct.lead", { number: original.number })}</p>
      <form.Form aria-label={say("invoices.correct.title", { number: original.number })} className="flex flex-col gap-3">
        <form.FieldArray name="lines">
          {(array) => (
            <div className="flex flex-col gap-3">
              {array.items.map((_, i) => (
                <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_9rem_auto]">
                  <form.TextField name={`lines[${i}].description` as const} label={say("invoices.correct.description")} />
                  <form.TextField name={`lines[${i}].quantity` as const} label={say("invoices.new.quantity")} inputMode="decimal" />
                  <form.Money name={`lines[${i}].unitPriceCents` as const} label={say("invoices.correct.unitPrice")} currency="CAD" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => array.remove(i)} disabled={array.items.length === 1}>
                    {say("invoices.correct.remove")}
                  </Button>
                </div>
              ))}
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => array.push({ description: "", quantity: "1", unitPriceCents: 0, category: "standard" })}>
                  {say("invoices.correct.add")}
                </Button>
              </div>
            </div>
          )}
        </form.FieldArray>
        {needLine ? <Alert tone="danger">{say("invoices.new.needLine")}</Alert> : null}
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <div>
          <form.Submit size="md" variant="primary" className="w-full sm:w-auto">
            {say("invoices.correct.submit")}
          </form.Submit>
        </div>
      </form.Form>
    </Card.Root>
  );
}
