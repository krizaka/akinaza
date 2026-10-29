"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { useState } from "react";

import { TemplateChoiceGrid } from "@/components/app/TemplateChoiceGrid";
import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import type { TemplateChoices } from "@/lib/template-choices";

/**
 * « Modèle de page », inside « Apparence » (#261, step 4): the trade's templates as tiles with a preview, the applied one marked, the administrator's default preselected
 * when none is applied. Applying replaces the section order with the template's — unless the owner reordered or hid sections by hand: then they say whether to keep their
 * order. Texts, photos and translations are never touched.
 */
export function TemplatePicker({ data, shopId }: Readonly<{ data: TemplateChoices; shopId: string }>) {
  const { say } = useSay();
  const call = useCall();
  const [value, setValue] = useState(data.current?.id ?? data.preselected ?? data.choices[0]?.id ?? "");
  const [saved, setSaved] = useState(false);
  const chosen = data.choices.find((t) => t.id === value);
  const isCurrent = chosen !== undefined && data.current?.id === chosen.id && data.current.version === chosen.version;
  // The applied template has a newer version out (step 5): the shop keeps its own until the owner updates, with the same rule for their order.
  const update = chosen !== undefined && data.current?.id === chosen.id && data.updateAvailable !== null && chosen.version === data.updateAvailable.version;
  const words = update ? { one: "update", keep: "updateKeepOrder", order: "updateTemplateOrder" } : { one: "use", keep: "useKeepOrder", order: "useTemplateOrder" };
  const vars = update ? { version: chosen.version } : undefined;
  const apply = async (keepOrder?: boolean) => {
    if (!chosen) return;
    setSaved(false);
    const ok = await call.run(`/api/walker/shop-page/template?shopId=${encodeURIComponent(shopId)}`, { json: { templateId: chosen.id, templateVersion: chosen.version, ...(keepOrder === undefined ? {} : { keepOrder }) } });
    setSaved(ok !== null);
  };
  return (
    <Card.Root className="flex flex-col gap-4 p-4 lg:col-span-2">
      <div>
        <h2 className="font-display text-base font-bold text-fg">{say("shopSetup.templates.title")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{say("shopSetup.templates.lead")}</p>
      </div>
      {data.choices.length ? <TemplateChoiceGrid choices={data.choices} value={value} onValueChange={setValue} current={data.current?.id} outdated={data.updateAvailable !== null} preselected={data.preselected} label={say("shopSetup.templates.label")} /> : <p className="m-0 text-sm text-fg-secondary">{say("shopSetup.templates.noneOffered")}</p>}
      {chosen ? (
        <div className="flex flex-col gap-3">
          {update ? <p className="m-0 text-sm text-fg-secondary">{say("shopSetup.templates.updateLead", { version: chosen.version })}</p> : null}
          {isCurrent && <p className="m-0 text-sm text-fg-secondary">{say("shopSetup.templates.isCurrent")}</p>}
          {!isCurrent && (data.sectionsCustom ? (
            <>
              <p className="m-0 text-sm text-fg-secondary">{say("shopSetup.templates.customNote")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="md" variant="primary" disabled={call.pending} onClick={() => void apply(true)}>{say(`shopSetup.templates.${words.keep}`, vars)}</Button>
                <Button size="md" variant="secondary" disabled={call.pending} onClick={() => void apply(false)}>{say(`shopSetup.templates.${words.order}`, vars)}</Button>
              </div>
            </>
          ) : (
            <Button size="md" variant="primary" className="self-start" disabled={call.pending} onClick={() => void apply()}>{say(`shopSetup.templates.${words.one}`, vars)}</Button>
          ))}
        </div>
      ) : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {saved ? <Alert tone="success">{say("shopSetup.templates.applied")}</Alert> : null}
    </Card.Root>
  );
}
