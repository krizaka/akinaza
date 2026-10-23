"use client";

import { BUSINESS_TYPES, type BusinessType } from "@akinaza/core";
import { krizakaFetch } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { rememberShop } from "@/app/actions/remember-shop";
import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { type RouteLocale, shopRoutes } from "@/lib/routes";

const newShopForm = createKrizakaForm({
  schema: z.object({ name: z.string().trim().min(1).max(80), businessType: z.enum(BUSINESS_TYPES), legalName: z.string().trim().min(1).max(120), address: z.string().trim().min(1).max(200), slug: z.string().trim().min(3).max(40), ownerName: z.string().trim().min(1).max(80) }),
  defaultValues: { name: "", businessType: "professional" as BusinessType, legalName: "", address: "", slug: "", ownerName: "" },
});

/** « Add a shop »: one more shop under the same account, unpublished, then its own setup page opens. The administrator bounds how many. */
export function NewShop({ locale, backHref }: { locale: RouteLocale; backHref: string }) {
  const { say, locale: uiLocale } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const form = newShopForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale: uiLocale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        const created = (await krizakaFetch("/api/walker/shop?additional=1", { method: "POST", json: { ...values, taglineFr: "", taglineEn: "", published: false } })) as { shopId: string };
        await rememberShop(created.shopId);
        router.push(shopRoutes(locale, created.shopId).setup);
        router.refresh();
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-fg">{say("shopSetup.addShop.title")}</h1>
        <p className="text-fg-secondary">{say("shopSetup.addShop.lead")}</p>
        <p className="text-sm"><Link className="font-semibold text-fg-accent underline" href={backHref}>{say("shopSetup.addShop.back")}</Link></p>
      </header>
      <Card.Root className="p-4">
        <form.Form aria-label={say("shopSetup.addShop.title")} className="grid gap-4 sm:grid-cols-2">
          <form.TextField name="name" label={say("shopSetup.page.name")} autoComplete="organization" />
          <form.Select name="businessType" label={say("shopSetup.page.businessType")} hint={say("shopSetup.page.businessTypeHint")} options={BUSINESS_TYPES.map((type) => ({ value: type, label: say(`shopSetup.page.businessTypes.${type}`) }))} />
          <form.TextField name="legalName" label={say("shopSetup.page.legalName")} />
          <form.TextField name="ownerName" label={say("shopSetup.page.ownerName")} autoComplete="given-name" />
          <div className="sm:col-span-2"><form.TextField name="address" label={say("shopSetup.page.address")} hint={say("shopSetup.sections.contact.addressPrivate")} autoComplete="street-address" /></div>
          <div className="sm:col-span-2"><form.TextField name="slug" label={say("shopSetup.page.slug")} hint={say("shopSetup.page.slugHint")} transform={(v) => v.toLowerCase().replace(/[^a-z0-9-]/g, "-")} /></div>
          <div className="flex flex-col gap-3 sm:col-span-2">
            {problem ? <Alert tone="danger">{problem}</Alert> : null}
            <form.Submit size="md" className="w-full sm:w-auto sm:self-start">{say("shopSetup.addShop.submit")}</form.Submit>
          </div>
        </form.Form>
      </Card.Root>
    </div>
  );
}
