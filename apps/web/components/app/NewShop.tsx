"use client";

import { krizakaFetch } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Card } from "@krizaka/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { rememberShop } from "@/app/actions/remember-shop";
import { IdentityFields, identityForm } from "@/components/app/ShopPageSections";
import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { type RouteLocale, shopRoutes } from "@/lib/routes";

/** « Add a shop »: one more shop under the same account, unpublished, then its own setup page opens. The administrator bounds how many. */
export function NewShop({ locale, backHref }: { locale: RouteLocale; backHref: string }) {
  const { say, locale: uiLocale } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const form = identityForm.useForm({
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
          <IdentityFields form={form} say={say} withAddress />
          <div className="flex flex-col gap-3 sm:col-span-2">
            {problem ? <Alert tone="danger">{problem}</Alert> : null}
            <form.Submit size="md" className="w-full sm:w-auto sm:self-start">{say("shopSetup.addShop.submit")}</form.Submit>
          </div>
        </form.Form>
      </Card.Root>
    </div>
  );
}
