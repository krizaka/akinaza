"use client";

import { BUSINESS_TYPES, type BusinessType } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import type { SetupData } from "@/components/app/ShopSetup";
import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { shopRoutes } from "@/lib/routes";

type Page = NonNullable<SetupData["page"]>;

/** Every section saves the page the way the server wants it (the whole page), changing only its own fields: the others are kept as they are. */
function useSectionSave(page: Page | null) {
  const { say, locale } = useSay();
  const call = useCall();
  const [saved, setSaved] = useState(false);
  return {
    say,
    locale,
    call,
    saved,
    i18n: { t: (key: string, vars?: Record<string, unknown>) => say(key, vars as Record<string, string | number> | undefined), locale },
    save: async (values: Partial<Page>) => {
      setSaved(false);
      const next = { ...EMPTY, ...(page ?? {}), ...values };
      setSaved((await call.run("/api/walker/shop", { json: next })) !== null);
    },
  };
}

const EMPTY: Page = { name: "", legalName: "", address: "", slug: "", ownerName: "", taglineFr: "", taglineEn: "", published: false, area: "", bioFr: "", bioEn: "", publicPhone: "", publicEmail: "", seatUnitFr: "", seatUnitEn: "", businessType: "professional" };

/** The frame of a section: title, one line of what it is for, then its form. */
function SectionCard({ title, lead, badge, children }: { title: string; lead: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card.Root className="p-4">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-base font-bold text-fg">{title}</h2>
        {badge}
      </div>
      <p className="mb-4 text-sm text-fg-secondary">{lead}</p>
      {children}
    </Card.Root>
  );
}

/** The foot of a section's form: what the save answered, then its one button. */
function SectionFooter({ s, Submit }: { s: ReturnType<typeof useSectionSave>; Submit: React.ComponentType<{ size?: "md"; className?: string; children: React.ReactNode }> }) {
  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <SectionStatus s={s} />
      <Submit size="md" className="w-full sm:w-auto sm:self-start">{s.say("shopSetup.sections.save")}</Submit>
    </div>
  );
}

/** What a save answered: the refusal in words, or « Saved ». */
function SectionStatus({ s }: { s: ReturnType<typeof useSectionSave> }) {
  return (
    <>
      {s.call.problem ? <Alert tone="danger">{s.call.problem}</Alert> : null}
      {s.saved ? <Alert tone="success">{s.say("shopSetup.sections.saved")}</Alert> : null}
    </>
  );
}

export const identityForm = createKrizakaForm({
  schema: z.object({ name: z.string().trim().min(1).max(80), businessType: z.enum(BUSINESS_TYPES), legalName: z.string().trim().min(1).max(120), ownerName: z.string().trim().min(1).max(80), slug: z.string().trim().min(3).max(40), address: z.string().trim().min(1).max(200) }),
  defaultValues: { name: "", businessType: "professional" as BusinessType, legalName: "", ownerName: "", slug: "", address: "" },
});

/** The fields that say who a shop is: shared by the identity section and « Add a shop ». */
export function IdentityFields({ form, say, withAddress = false }: { form: ReturnType<typeof identityForm.useForm>; say: ReturnType<typeof useSay>["say"]; withAddress?: boolean }) {
  return (
    <>
      <form.TextField name="name" label={say("shopSetup.page.name")} autoComplete="organization" />
      <form.Select name="businessType" label={say("shopSetup.page.businessType")} hint={say("shopSetup.page.businessTypeHint")} options={BUSINESS_TYPES.map((type) => ({ value: type, label: say(`shopSetup.page.businessTypes.${type}`) }))} />
      <form.TextField name="legalName" label={say("shopSetup.page.legalName")} hint={say("shopSetup.sections.identity.legalHint")} />
      <form.TextField name="ownerName" label={say("shopSetup.page.ownerName")} autoComplete="given-name" />
      {withAddress ? (
        <div className="sm:col-span-2">
          <form.TextField name="address" label={say("shopSetup.page.address")} hint={say("shopSetup.sections.contact.addressPrivate")} autoComplete="street-address" />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <form.TextField name="slug" label={say("shopSetup.page.slug")} hint={say("shopSetup.page.slugHint")} transform={(v) => v.toLowerCase().replace(/[^a-z0-9-]/g, "-")} />
      </div>
    </>
  );
}

/** Identity: who the shop is. */
export function IdentitySection({ page }: { page: Page | null }) {
  const s = useSectionSave(page);
  const form = identityForm.useForm({ i18n: s.i18n, defaultValues: { name: page?.name ?? "", businessType: page?.businessType ?? "professional", legalName: page?.legalName ?? "", ownerName: page?.ownerName ?? "", slug: page?.slug ?? "", address: page?.address ?? "" }, onSubmit: (v) => s.save(v) });
  return (
    <SectionCard title={s.say("shopSetup.sections.identity.title")} lead={s.say("shopSetup.sections.identity.lead")}>
      <form.Form aria-label={s.say("shopSetup.sections.identity.title")} className="grid gap-4 sm:grid-cols-2">
        <IdentityFields form={form} say={s.say} />
        <SectionFooter s={s} Submit={form.Submit} />
      </form.Form>
    </SectionCard>
  );
}

const textsForm = createKrizakaForm({
  schema: z.object({ taglineFr: z.string().trim().max(160), taglineEn: z.string().trim().max(160), bioFr: z.string().trim().max(600), bioEn: z.string().trim().max(600), seatUnitFr: z.string().trim().max(30), seatUnitEn: z.string().trim().max(30) }),
  defaultValues: { taglineFr: "", taglineEn: "", bioFr: "", bioEn: "", seatUnitFr: "", seatUnitEn: "" },
});

/** Your page: the texts, French and English side by side. */
export function TextsSection({ page, shopId }: { page: Page | null; shopId: string }) {
  const s = useSectionSave(page);
  const form = textsForm.useForm({ i18n: s.i18n, defaultValues: { taglineFr: page?.taglineFr ?? "", taglineEn: page?.taglineEn ?? "", bioFr: page?.bioFr ?? "", bioEn: page?.bioEn ?? "", seatUnitFr: page?.seatUnitFr ?? "", seatUnitEn: page?.seatUnitEn ?? "" }, onSubmit: (v) => s.save(v) });
  const say = s.say;
  return (
    <SectionCard title={say("shopSetup.sections.texts.title")} lead={say("shopSetup.sections.texts.lead")}>
      <form.Form aria-label={say("shopSetup.sections.texts.title")} className="grid gap-4 sm:grid-cols-2">
        <p className="m-0 text-sm font-semibold text-fg-secondary">{say("shopSetup.sections.texts.french")}</p>
        <p className="m-0 hidden text-sm font-semibold text-fg-secondary sm:block">{say("shopSetup.sections.texts.english")}</p>
        <form.TextField name="taglineFr" label={say("shopSetup.sections.texts.tagline")} />
        <form.TextField name="taglineEn" label={say("shopSetup.sections.texts.tagline")} />
        <form.TextArea name="bioFr" label={say("shopSetup.sections.texts.bio")} hint={say("shopSetup.page.bioHint")} rows={4} maxLength={600} />
        <form.TextArea name="bioEn" label={say("shopSetup.sections.texts.bio")} hint={say("shopSetup.page.bioHint")} rows={4} maxLength={600} />
        <form.TextField name="seatUnitFr" label={say("shopSetup.sections.texts.seatUnit")} hint={say("shopSetup.page.seatUnitHint")} />
        <form.TextField name="seatUnitEn" label={say("shopSetup.sections.texts.seatUnit")} />
        <p className="m-0 text-sm text-fg-secondary sm:col-span-2">
          {say("shopSetup.sections.texts.moreLanguages")}{" "}
          <Link className="font-semibold text-fg-accent underline" href={`${shopRoutes(s.locale, shopId).setup}/languages`}>{say("shopLanguages.open")}</Link>
        </p>
        <SectionFooter s={s} Submit={form.Submit} />
      </form.Form>
    </SectionCard>
  );
}

const contactForm = createKrizakaForm({
  schema: z.object({ address: z.string().trim().min(1).max(200), area: z.string().trim().max(80), publicPhone: z.string().trim().max(40), publicEmail: z.string().trim().max(120) }),
  defaultValues: { address: "", area: "", publicPhone: "", publicEmail: "" },
});

/** Contact and place: the street address stays private; what visitors see is the locality, a phone and an e-mail. */
export function ContactSection({ page }: { page: Page | null }) {
  const s = useSectionSave(page);
  const form = contactForm.useForm({ i18n: s.i18n, defaultValues: { address: page?.address ?? "", area: page?.area ?? "", publicPhone: page?.publicPhone ?? "", publicEmail: page?.publicEmail ?? "" }, onSubmit: (v) => s.save(v) });
  const say = s.say;
  return (
    <SectionCard title={say("shopSetup.sections.contact.title")} lead={say("shopSetup.sections.contact.lead")}>
      <form.Form aria-label={say("shopSetup.sections.contact.title")} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <form.TextField name="address" label={say("shopSetup.page.address")} hint={say("shopSetup.sections.contact.addressPrivate")} autoComplete="street-address" />
        </div>
        <div className="sm:col-span-2">
          <form.TextField name="area" label={say("shopSetup.page.area")} hint={say("shopSetup.page.areaHint")} />
        </div>
        <form.TextField name="publicPhone" label={say("shopSetup.page.publicPhone")} type="tel" autoComplete="tel" />
        <form.TextField name="publicEmail" label={say("shopSetup.page.publicEmail")} type="email" autoComplete="email" />
        <SectionFooter s={s} Submit={form.Submit} />
      </form.Form>
    </SectionCard>
  );
}

const publishForm = createKrizakaForm({ schema: z.object({ published: z.boolean() }), defaultValues: { published: false } });

/** Publish: the switch and the public link, nothing else. */
export function PublishSection({ page, publicUrl }: { page: Page | null; publicUrl: string | null }) {
  const s = useSectionSave(page);
  const form = publishForm.useForm({ i18n: s.i18n, defaultValues: { published: page?.published ?? false }, onSubmit: (v) => s.save(v) });
  const say = s.say;
  return (
    <SectionCard title={say("shopSetup.sections.publish.title")} lead={say("shopSetup.sections.publish.lead")} badge={<Badge tone={page?.published ? "success" : "neutral"}>{say(page?.published ? "shopSetup.published" : "shopSetup.notPublished")}</Badge>}>
      <form.Form aria-label={say("shopSetup.sections.publish.title")} className="flex flex-col gap-4">
        <form.Switch name="published" label={say("shopSetup.page.published")} hint={say("shopSetup.page.publishedHint")} />
        {publicUrl ? <p className="m-0 text-sm"><a className="font-semibold text-fg-accent underline" href={publicUrl}>{say("shopSetup.viewPage")}</a> <span className="font-mono text-xs text-fg-muted">{publicUrl}</span></p> : null}
        <SectionStatus s={s} />
        <form.Submit size="md" className="w-full sm:w-auto sm:self-start">{say("shopSetup.sections.save")}</form.Submit>
      </form.Form>
    </SectionCard>
  );
}
