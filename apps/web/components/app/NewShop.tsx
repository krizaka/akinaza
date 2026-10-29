"use client";

import { SHOP_TYPES, type ShopType } from "@akinaza/core";
import { krizakaFetch } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";
import { Field, Select } from "@krizaka/ui/field";
import { PageHeader } from "@krizaka/ui/page-header";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { rememberShop } from "@/app/actions/remember-shop";
import { IdentityFields, identityForm } from "@/components/app/ShopPageSections";
import { PLAIN_PAGE, TemplateChoiceGrid } from "@/components/app/TemplateChoiceGrid";
import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { setUpNewShop } from "@/lib/new-shop-setup";
import { type RouteLocale, shopRoutes } from "@/lib/routes";
import type { TemplateChoices } from "@/lib/template-choices";

/** The business type a trade stands for: pet care is the pets type, every other trade a professional shop. */
const businessTypeOf = (trade: ShopType) => (trade === "pets" ? ("pets" as const) : ("professional" as const));

/**
 * « Add a shop »: one more shop under the same account, unpublished, then its own setup page opens. The administrator bounds how many.
 * With templates offered (#261): the trade is asked (it stands for the business type) and a template preselected — the administrator's default for the trade —
 * which applies only because the owner keeps it chosen; « Plain page » keeps today's page. `first` is a client opening their first shop (K7): the same form, its own words.
 */
export function NewShop({ locale, backHref, first = false, offers = null }: Readonly<{ locale: RouteLocale; backHref: string; first?: boolean; /** The templates of every trade, or null while the administrator's switch is off. */ offers?: Record<ShopType, TemplateChoices> | null }>) {
  const words = first ? "shopSetup.openShop" : "shopSetup.addShop";
  const { say, locale: uiLocale } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [trade, setTrade] = useState<ShopType>("consulting");
  const [template, setTemplate] = useState<string>(offers?.consulting.preselected ?? PLAIN_PAGE);
  /** The shop made by a first attempt: a retry after a failed setup reuses it (#291 review). */
  const made = useRef<{ shopId: string | null }>({ shopId: null });
  const choices = offers?.[trade] ?? null;
  const form = identityForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale: uiLocale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        const page = { ...values, ...(offers ? { businessType: businessTypeOf(trade) } : {}), taglineFr: "", taglineEn: "", published: false };
        const shopId = await setUpNewShop(
          made.current,
          async () => ((await krizakaFetch("/api/walker/shop?additional=1", { method: "POST", json: page })) as { shopId: string }).shopId,
          async (id) => {
            if (!offers) return;
            const shop = encodeURIComponent(id);
            await krizakaFetch(`/api/walker/shop-page?shopId=${shop}`, { method: "POST", json: { shopType: trade } });
            const chosen = choices?.choices.find((t) => t.id === template);
            if (chosen) await krizakaFetch(`/api/walker/shop-page/template?shopId=${shop}`, { method: "POST", json: { templateId: chosen.id, templateVersion: chosen.version } });
          },
        );
        await rememberShop(shopId);
        router.push(shopRoutes(locale, shopId).setup);
        router.refresh();
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={say(`${words}.title`)} description={say(`${words}.lead`)} />
      <p className="text-sm"><Link className="font-semibold text-fg-accent underline" href={backHref}>{say(`${words}.back`)}</Link></p>
      <Card.Root className="p-4">
        <form.Form aria-label={say(`${words}.title`)} className="grid gap-4 sm:grid-cols-2">
          <IdentityFields form={form} say={say} withAddress withBusinessType={!offers} />
          {offers ? (
            <>
              <Field.Root>
                <Field.Label htmlFor="new-shop-trade">{say("shopSetup.addShop.trade")}</Field.Label>
                <Select id="new-shop-trade" value={trade} onChange={(e) => { const next = e.target.value as ShopType; setTrade(next); setTemplate(offers[next].preselected ?? PLAIN_PAGE); }}>
                  {SHOP_TYPES.map((x) => <option key={x} value={x}>{say(`shopSetup.defaults.types.${x}`)}</option>)}
                </Select>
                <p className="m-0 text-xs text-fg-secondary">{say("shopSetup.addShop.tradeHint")}</p>
              </Field.Root>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <h2 className="m-0 font-display text-base font-bold text-fg">{say("shopSetup.addShop.template")}</h2>
                <p className="m-0 text-sm text-fg-secondary">{say("shopSetup.addShop.templateHint")}</p>
                {choices ? <TemplateChoiceGrid choices={choices.choices} value={template} onValueChange={setTemplate} preselected={choices.preselected} plainPage label={say("shopSetup.addShop.template")} /> : null}
              </div>
            </>
          ) : null}
          <div className="flex flex-col gap-3 sm:col-span-2">
            {problem ? <Alert tone="danger">{problem}</Alert> : null}
            <form.Submit size="md" className="w-full sm:w-auto sm:self-start">{say(`${words}.submit`)}</form.Submit>
          </div>
        </form.Form>
      </Card.Root>
    </div>
  );
}
