"use client";

import type { BusinessType } from "@akinaza/core";
import type { ShopPageConfig, ShopPageSection } from "@akinaza/db";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Checkbox } from "@krizaka/ui/checkbox";
import { createKrizakaForm } from "@krizaka/ui/form";
import { PageHeader } from "@krizaka/ui/page-header";
import { useState } from "react";
import { z } from "zod";

import { ProposedImages, type ProposedImagesData } from "@/components/app/ProposedImages";
import { ContactSection, IdentitySection, PublishSection, TextsSection } from "@/components/app/ShopPageSections";
import { TemplatePicker } from "@/components/app/TemplatePicker";
import { useCall } from "@/components/app/useCall";
import { type PageTab } from "@/lib/boutique";
import { useSay, useVocabulary } from "@/lib/i18n-client";
import { shrinkImage, STOREFRONT_LONG_SIDE } from "@/lib/shrink-image";
import { type GalleryLine, galleryText, joinLines, keepExtras, parseGallery, splitLines } from "@/lib/storefront-form";
import type { TemplateChoices } from "@/lib/template-choices";

/** What the setup page needs, plain (the server picks it from the shop). */
export interface SetupData {
  page: { name: string; legalName: string; address: string; slug: string; ownerName: string; taglineFr: string; taglineEn: string; published: boolean; area: string; bioFr: string; bioEn: string; publicPhone: string; publicEmail: string; seatUnitFr: string; seatUnitEn: string; businessType: BusinessType } | null;
  shopId: string | null;
  pageConfig: ShopPageConfig;
  publicUrl: string | null;
  zones: { id: string; name: string }[];
  services: { id: string; nameFr: string; nameEn: string; durationMinutes: number; priceCents: number; capacity: number; descriptionFr: string; descriptionEn: string; includedFr: string[]; includedEn: string[]; priceVaries: boolean }[];
  media: { cover: (GalleryLine) | null; gallery: GalleryLine[] };
  windows: { id: string; weekday: number; startsAt: string; endsAt: string }[];
  daysOff: { id: string; onDate: string; reason: string | null }[];
  /** The proposed images (#267): null when the administrator has switched them off. */
  proposed: ProposedImagesData | null;
  /** The page templates of the shop's trade (#261): null while the administrator's switch is off. */
  templates: TemplateChoices | null;
  rules: { cancellationHours: number; bookingHorizonDays: number; slotStepMinutes: number; minNoticeMinutes: number; reportLinkDays: number; paymentTermsDays: number } | null;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
const money = (cents: number, locale: string) => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

/**
 * « Ma page boutique » (K4): the section the hub opens, one at a time. The section is named by the hub's navigation (`?tab=`), never a
 * row of tabs; each section saves on its own. The shop's name, its status and its public link are the hub's header, not this one.
 */
export function ShopSetupView({ data, tab = "identity" }: { data: SetupData; /** The section the hub opens (`?tab=`). */ tab?: PageTab }) {
  const { say } = useSay();
  if (!data.page || !data.shopId) return <IdentitySection page={data.page} />;
  const body: Record<PageTab, React.ReactNode> = {
    identity: <IdentitySection page={data.page} />,
    texts: <TextsSection page={data.page} shopId={data.shopId} />,
    contact: <ContactSection page={data.page} />,
    offer: (
      <div className="grid gap-4 lg:grid-cols-2">
        <ZonesCard zones={data.zones} />
        <ServicesCard services={data.services} />
        <HoursCard windows={data.windows} daysOff={data.daysOff} />
        {data.rules ? <RulesCard rules={data.rules} /> : null}
      </div>
    ),
    media: (
      <div className="grid gap-4 lg:grid-cols-2">
        <MediaCard media={data.media} />
        {data.proposed ? <ProposedImages data={data.proposed} /> : null}
      </div>
    ),
    look: (
      <div className="grid gap-4 lg:grid-cols-2">
        {data.templates ? <TemplatePicker data={data.templates} shopId={data.shopId} /> : null}
        <ShopPageCard shopId={data.shopId} publicUrl={data.publicUrl} config={data.pageConfig} />
      </div>
    ),
    publish: <PublishSection page={data.page} publicUrl={data.publicUrl} />,
    // The shop as a place (B45) has its own panels, opened by the hub (boutique/[section]/page.tsx).
    wall: null,
    reels: null,
    board: null,
    reviews: null,
  };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader as="h2" title={say(`shopSetup.sections.tabs.${tab}`)} />
      {body[tab]}
    </div>
  );
}

const logoForm = createKrizakaForm({
  schema: z.object({ files: z.array(z.instanceof(File)).max(1) }),
  defaultValues: { files: [] as File[] },
});

function ShopPageCard({ shopId, publicUrl, config: initial }: { shopId: string; publicUrl: string | null; config: ShopPageConfig }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [config, setConfig] = useState(initial);
  // A route refresh (a template applied elsewhere in the page) hands a new configuration: the card takes it over, or it would post its old order back.
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setConfig(initial);
  }
  const [saved, setSaved] = useState(false);
  const save = async (next: ShopPageConfig) => {
    setSaved(false);
    if (await call.run(`/api/walker/shop-page?shopId=${encodeURIComponent(shopId)}`, { json: next })) {
      setConfig(next);
      setSaved(true);
    }
  };
  const reorder = (section: ShopPageSection, direction: -1 | 1) => {
    const sections = [...config.sections];
    const from = sections.findIndex((item) => item.id === section);
    const to = from + direction;
    if (to < 0 || to >= sections.length) return;
    [sections[from], sections[to]] = [sections[to]!, sections[from]!];
    void save({ ...config, sections });
  };
  const form = logoForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async ({ files }) => {
      const file = files[0];
      if (!file) return;
      const body = new FormData();
      body.set("file", await shrinkImage(file, STOREFRONT_LONG_SIDE), "logo.jpg");
      body.set("purpose", "brand");
      const url = (await call.run<{ url: string }>(`/api/walker/media/upload?shopId=${encodeURIComponent(shopId)}`, { body }, { refresh: false }))?.url;
      if (url) await save({ ...config, logoUrl: url });
      form.reset({ files: [] });
    },
  });
  return (
    <Card.Root className="p-4 lg:col-span-2">
      <h2 className="mb-3 font-display text-base font-bold text-fg">{say("shopSetup.layout.title")}</h2>
      {publicUrl ? <a className="mb-3 inline-block text-sm font-semibold text-fg-accent underline" href={publicUrl}>{say("shopSetup.viewPage")}</a> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {config.sections.map(({ id, visible }, index) => (
          <li key={id} tabIndex={0} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default p-2"
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                reorder(id, event.key === "ArrowUp" ? -1 : 1);
              }
            }}>
            <Checkbox checked={visible} onCheckedChange={(checked) => void save({ ...config, sections: config.sections.map((item) => item.id === id ? { ...item, visible: checked === true } : item) })}>
              {say(`shopSetup.layout.sections.${id}`)}{(["wall", "reels", "announcements", "reviews", "follow"] as ShopPageSection[]).includes(id) ? ` · ${say("shopSetup.layout.preparing")}` : ""}
            </Checkbox>
            <span className="ml-auto flex gap-1">
              <Button type="button" size="sm" variant="ghost" disabled={index === 0} aria-label={say("shopSetup.layout.moveUp", { section: say(`shopSetup.layout.sections.${id}`) })} onClick={() => reorder(id, -1)}>↑</Button>
              <Button type="button" size="sm" variant="ghost" disabled={index === config.sections.length - 1} aria-label={say("shopSetup.layout.moveDown", { section: say(`shopSetup.layout.sections.${id}`) })} onClick={() => reorder(id, 1)}>↓</Button>
            </span>
          </li>
        ))}
      </ul>
      <form.Form aria-label={say("shopSetup.layout.logo")} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <form.FileUpload name="files" label={say("shopSetup.layout.logo")} title={say("shopSetup.layout.logo")} browseLabel={say("shopSetup.media.browse")} hint={say("shopSetup.media.uploadHint")} accept="image/*" maxSize={2 * 1024 * 1024} maxFiles={1} removeLabel={(name) => say("shopSetup.media.remove", { name })} refusalLabel={(r) => say("shopSetup.media.tooBig", { name: r.file.name })} />
        <form.Submit size="md" variant="secondary">{say("shopSetup.layout.uploadLogo")}</form.Submit>
      </form.Form>
      {call.problem ? <Alert tone="danger" className="mt-3">{call.problem}</Alert> : null}
      {saved ? <Alert tone="success" className="mt-3">{say("shopSetup.layout.saved")}</Alert> : null}
    </Card.Root>
  );
}

const coord = z.string().trim().max(14).regex(/^(-?\d+([.,]\d+)?)?$/);
const zoneForm = createKrizakaForm({ schema: z.object({ name: z.string().trim().min(1).max(80), lat: coord, lng: coord }), defaultValues: { name: "", lat: "", lng: "" } });

function ZonesCard({ zones }: { zones: SetupData["zones"] }) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = zoneForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      const lat = Number(values.lat.replace(",", "."));
      const lng = Number(values.lng.replace(",", "."));
      const place = values.lat && values.lng && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
      if ((await call.run("/api/walker/zones", { json: { name: values.name, ...(place ? { place } : {}) } })) !== null) form.reset();
    },
  });
  return (
    <Card.Root className="p-4">
      <h2 className="mb-3 font-display text-base font-bold text-fg">{say("shopSetup.zones.title")}</h2>
      {zones.length ? (
        <ul className="mb-4 flex flex-wrap gap-2">
          {zones.map((z) => (
            <li key={z.id} className="inline-flex items-center gap-1 rounded-sm border border-border-default bg-surface-2 py-1 pl-3 pr-1 text-sm text-fg">
              {z.name}
              <Button size="sm" variant="ghost" shape="pill" aria-label={say("shopSetup.zones.remove", { name: z.name })} onClick={() => call.run(`/api/walker/zones/${z.id}`, { method: "DELETE" })}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-fg-secondary">{say("shopSetup.zones.none")}</p>
      )}
      <form.Form aria-label={say("shopSetup.zones.title")} className="flex flex-col gap-3">
        <form.TextField name="name" label={say("shopSetup.zones.name")} placeholder={say("shopSetup.zones.placeholder")} />
        <div className="grid grid-cols-2 gap-3">
          <form.TextField name="lat" label={say("shopSetup.zones.lat")} inputMode="decimal" hint={say("shopSetup.zones.placeHint")} />
          <form.TextField name="lng" label={say("shopSetup.zones.lng")} inputMode="decimal" />
        </div>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <form.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">
          {say("shopSetup.zones.add")}
        </form.Submit>
      </form.Form>
    </Card.Root>
  );
}

const serviceForm = createKrizakaForm({
  schema: z.object({
    nameFr: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    durationMinutes: z.string().regex(/^\d{1,3}$/),
    priceCents: z.number().int().min(0),
    capacity: z.string().regex(/^\d{1,2}$/),
    descriptionFr: z.string().trim().max(300),
    descriptionEn: z.string().trim().max(300),
    includedFr: z.string().max(600),
    includedEn: z.string().max(600),
    priceVaries: z.boolean(),
  }),
  defaultValues: { nameFr: "", nameEn: "", durationMinutes: "60", priceCents: 3000, capacity: "1", descriptionFr: "", descriptionEn: "", includedFr: "", includedEn: "", priceVaries: false },
});

type Service = SetupData["services"][number];

function ServicesCard({ services }: { services: SetupData["services"] }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [editing, setEditing] = useState<Service | null>(null);
  return (
    <Card.Root className="p-4">
      <h2 className="mb-3 font-display text-base font-bold text-fg">{say("shopSetup.services.title")}</h2>
      {services.length ? (
        <ul className="mb-4 flex flex-col divide-y divide-border-default">
          {services.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="font-semibold text-fg">{locale === "fr" ? s.nameFr : s.nameEn}</p>
                <p className="text-sm text-fg-secondary">
                  {say("shopSetup.services.line", { minutes: s.durationMinutes, price: money(s.priceCents, locale) })}
                  {s.capacity > 1 ? ` · ${say("shopSetup.services.group", { count: s.capacity })}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" aria-label={say("shopSetup.services.edit", { name: locale === "fr" ? s.nameFr : s.nameEn })} onClick={() => setEditing(s)}>
                  ✎
                </Button>
                <Button size="sm" variant="ghost" aria-label={say("shopSetup.services.remove", { name: locale === "fr" ? s.nameFr : s.nameEn })} onClick={() => call.run("/api/walker/services", { json: { id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, durationMinutes: s.durationMinutes, priceCents: s.priceCents, capacity: s.capacity, active: false } })}>
                  ×
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-fg-secondary">{say("shopSetup.services.none")}</p>
      )}
      <ServiceForm key={editing?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />
    </Card.Root>
  );
}

/** A new service, or (with `editing`) the one the owner picked: the same form, its fields filled. */
function ServiceForm({ editing, onDone }: { editing: Service | null; onDone: () => void }) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = serviceForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    ...(editing
      ? { defaultValues: { nameFr: editing.nameFr, nameEn: editing.nameEn, durationMinutes: String(editing.durationMinutes), priceCents: editing.priceCents, capacity: String(editing.capacity), descriptionFr: editing.descriptionFr, descriptionEn: editing.descriptionEn, includedFr: joinLines(editing.includedFr), includedEn: joinLines(editing.includedEn), priceVaries: editing.priceVaries } }
      : {}),
    onSubmit: async (values) => {
      const done = await call.run("/api/walker/services", {
        json: {
          ...(editing ? { id: editing.id } : {}),
          nameFr: values.nameFr,
          nameEn: values.nameEn,
          durationMinutes: Number(values.durationMinutes),
          priceCents: values.priceCents,
          capacity: Number(values.capacity),
          descriptionFr: values.descriptionFr,
          descriptionEn: values.descriptionEn,
          includedFr: splitLines(values.includedFr, 6),
          includedEn: splitLines(values.includedEn, 6),
          priceVaries: values.priceVaries,
        },
      });
      if (done !== null) {
        form.reset();
        onDone();
      }
    },
  });
  return (
    <form.Form aria-label={say(editing ? "shopSetup.services.editing" : "shopSetup.services.title")} className="grid gap-3 sm:grid-cols-2">
      {editing ? <p className="text-sm font-semibold text-fg-accent sm:col-span-2">{say("shopSetup.services.editing")}</p> : null}
      <form.TextField name="nameFr" label={say("shopSetup.services.nameFr")} />
      <form.TextField name="nameEn" label={say("shopSetup.services.nameEn")} />
      <form.TextField name="durationMinutes" label={say("shopSetup.services.duration")} inputMode="numeric" />
      <form.Money name="priceCents" label={say("shopSetup.services.price")} currency="CAD" />
      <form.TextField name="capacity" label={say("shopSetup.services.capacity")} hint={say("shopSetup.services.capacityHint")} inputMode="numeric" />
      <p className="self-end text-xs text-fg-muted">{say("shopSetup.services.taxes")}</p>
      <form.TextField name="descriptionFr" label={say("shopSetup.services.descriptionFr")} />
      <form.TextField name="descriptionEn" label={say("shopSetup.services.descriptionEn")} />
      <form.TextArea name="includedFr" label={say("shopSetup.services.includedFr")} hint={say("shopSetup.services.includedHint")} rows={3} />
      <form.TextArea name="includedEn" label={say("shopSetup.services.includedEn")} hint={say("shopSetup.services.includedHint")} rows={3} />
      <div className="sm:col-span-2">
        <form.Switch name="priceVaries" label={say("shopSetup.services.priceVaries")} />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <form.Submit size="md" variant="secondary" className="w-full sm:w-auto">
            {say(editing ? "shopSetup.services.save" : "shopSetup.services.add")}
          </form.Submit>
          {editing ? (
            <Button type="button" size="md" variant="ghost" onClick={onDone}>
              {say("shopSetup.services.cancel")}
            </Button>
          ) : null}
        </div>
      </div>
    </form.Form>
  );
}

// @fixed: the largest photo taken before it is redrawn small on the phone (a phone photo is 3–12 MB) — an input limit.
const MAX_STOREFRONT_PHOTO = 25 * 1024 * 1024;

const mediaForm = createKrizakaForm({
  schema: z.object({ coverUrl: z.string().trim().max(500), coverAltFr: z.string().trim().max(200), coverAltEn: z.string().trim().max(200), gallery: z.string().max(5000), coverFiles: z.array(z.instanceof(File)).max(1), galleryFiles: z.array(z.instanceof(File)).max(12) }),
  defaultValues: { coverUrl: "", coverAltFr: "", coverAltEn: "", gallery: "", coverFiles: [] as File[], galleryFiles: [] as File[] },
});

function MediaCard({ media }: { media: SetupData["media"] }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [saved, setSaved] = useState(false);
  const form = mediaForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: { coverUrl: media.cover?.url ?? "", coverAltFr: media.cover?.altFr ?? "", coverAltEn: media.cover?.altEn ?? "", gallery: galleryText(media.gallery), coverFiles: [], galleryFiles: [] },
    onSubmit: async (values) => {
      setSaved(false);
      // The chosen files are redrawn small and sent to the media storage first; their addresses join the form's.
      const send = async (file: File) => {
        const body = new FormData();
        body.set("file", await shrinkImage(file, STOREFRONT_LONG_SIDE), "photo.jpg");
        return (await call.run<{ url: string }>("/api/walker/media/upload", { body }, { refresh: false }))?.url ?? null;
      };
      const coverUrl = values.coverFiles[0] ? await send(values.coverFiles[0]) : values.coverUrl;
      const uploaded: string[] = [];
      for (const file of values.galleryFiles) {
        const url = await send(file);
        if (url === null) return;
        uploaded.push(`${url} | | `);
      }
      if (coverUrl === null) return;
      const cover = coverUrl ? keepExtras([{ url: coverUrl, altFr: values.coverAltFr, altEn: values.coverAltEn }], media.cover ? [media.cover] : [])[0]! : null;
      const gallery = [...keepExtras(parseGallery(values.gallery), media.gallery), ...parseGallery(uploaded.join("\n"))].slice(0, 12);
      setSaved((await call.run("/api/walker/media", { json: { cover, gallery } })) !== null);
      form.reset({ ...values, coverUrl, coverFiles: [], galleryFiles: [], gallery: galleryText(gallery) });
    },
  });
  return (
    <Card.Root className="p-4 lg:col-span-2">
      <h2 className="font-display text-base font-bold text-fg">{say("shopSetup.media.title")}</h2>
      <p className="mb-3 text-sm text-fg-secondary">{say("shopSetup.media.intro")}</p>
      <form.Form aria-label={say("shopSetup.media.title")} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <form.FileUpload name="coverFiles" label={say("shopSetup.media.uploadCover")} title={say("shopSetup.media.uploadCoverTitle")} browseLabel={say("shopSetup.media.browse")} hint={say("shopSetup.media.uploadHint")} accept="image/*" maxSize={MAX_STOREFRONT_PHOTO} maxFiles={1} removeLabel={(name) => say("shopSetup.media.remove", { name })} refusalLabel={(r) => say("shopSetup.media.tooBig", { name: r.file.name })} />
        </div>
        <div className="sm:col-span-2">
          <form.TextField name="coverUrl" label={say("shopSetup.media.cover")} hint={say("shopSetup.media.coverHint")} inputMode="url" />
        </div>
        <form.TextField name="coverAltFr" label={say("shopSetup.media.coverAltFr")} />
        <form.TextField name="coverAltEn" label={say("shopSetup.media.coverAltEn")} />
        <div className="sm:col-span-2">
          <form.FileUpload name="galleryFiles" label={say("shopSetup.media.uploadGallery")} title={say("shopSetup.media.uploadGalleryTitle")} browseLabel={say("shopSetup.media.browse")} hint={say("shopSetup.media.uploadHint")} accept="image/*" maxSize={MAX_STOREFRONT_PHOTO} multiple maxFiles={12} removeLabel={(name) => say("shopSetup.media.remove", { name })} refusalLabel={(r) => say("shopSetup.media.tooBig", { name: r.file.name })} />
        </div>
        <div className="sm:col-span-2">
          <form.TextArea name="gallery" label={say("shopSetup.media.gallery")} hint={say("shopSetup.media.galleryHint")} rows={5} />
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2">
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          {saved ? <Alert tone="success">{say("shopSetup.media.saved")}</Alert> : null}
          <form.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">
            {say("shopSetup.media.submit")}
          </form.Submit>
        </div>
      </form.Form>
    </Card.Root>
  );
}

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const hoursForm = createKrizakaForm({ schema: z.object({ weekday: z.string().regex(/^[0-6]$/), startsAt: clock, endsAt: clock }), defaultValues: { weekday: "1", startsAt: "09:00", endsAt: "17:00" } });
const dayOffForm = createKrizakaForm({ schema: z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().max(120) }), defaultValues: { day: "", reason: "" } });

function HoursCard({ windows, daysOff }: { windows: SetupData["windows"]; daysOff: SetupData["daysOff"] }) {
  const { say, locale } = useSay();
  const call = useCall();
  const i18n = { t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale };
  const hours = hoursForm.useForm({
    i18n,
    onSubmit: async (values) => {
      await call.run("/api/walker/hours", { json: { weekday: Number(values.weekday), startsAt: values.startsAt, endsAt: values.endsAt } });
    },
  });
  const off = dayOffForm.useForm({
    i18n,
    onSubmit: async (values) => {
      if ((await call.run("/api/walker/days-off", { json: { day: values.day, reason: values.reason || undefined } })) !== null) off.reset();
    },
  });
  const dayName = (weekday: number) => say(`shopSetup.weekdays.${weekday}`);
  return (
    <Card.Root className="p-4">
      <h2 className="mb-3 font-display text-base font-bold text-fg">{say("shopSetup.hours.title")}</h2>
      {windows.length ? (
        <ul className="mb-4 flex flex-col divide-y divide-border-default">
          {[...windows].sort((a, b) => WEEK.indexOf(a.weekday as never) - WEEK.indexOf(b.weekday as never) || a.startsAt.localeCompare(b.startsAt)).map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="text-fg">
                {dayName(w.weekday)} <span className="tabular-nums text-fg-secondary">{w.startsAt.slice(0, 5)}–{w.endsAt.slice(0, 5)}</span>
              </span>
              <Button size="sm" variant="ghost" aria-label={say("shopSetup.hours.remove", { day: dayName(w.weekday), from: w.startsAt.slice(0, 5), to: w.endsAt.slice(0, 5) })} onClick={() => call.run(`/api/walker/hours/${w.id}`, { method: "DELETE" })}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-fg-secondary">{say("shopSetup.hours.none")}</p>
      )}
      <hours.Form aria-label={say("shopSetup.hours.title")} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <hours.Select name="weekday" label={say("shopSetup.hours.weekday")} options={WEEK.map((d) => ({ value: String(d), label: dayName(d) }))} />
        </div>
        <hours.TextField name="startsAt" label={say("shopSetup.hours.from")} hint={say("shopSetup.hours.timeHint")} inputMode="numeric" />
        <hours.TextField name="endsAt" label={say("shopSetup.hours.to")} inputMode="numeric" />
        <div className="col-span-2">
          <hours.Submit size="md" variant="secondary" className="w-full sm:w-auto">
            {say("shopSetup.hours.add")}
          </hours.Submit>
        </div>
      </hours.Form>
      <h3 className="mb-2 mt-6 font-display text-sm font-bold text-fg">{say("shopSetup.hours.dayOff")}</h3>
      {daysOff.length ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {daysOff.map((d) => (
            <li key={d.id} className="inline-flex items-center gap-1 rounded-sm border border-border-default bg-surface-2 py-1 pl-3 pr-1 text-sm text-fg">
              <span className="tabular-nums">{d.onDate}</span>
              {d.reason ? <span className="text-fg-secondary">· {d.reason}</span> : null}
              <Button size="sm" variant="ghost" shape="pill" aria-label={say("shopSetup.hours.dayOffRemove", { day: d.onDate })} onClick={() => call.run(`/api/walker/days-off/${d.onDate}`, { method: "DELETE" })}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <off.Form aria-label={say("shopSetup.hours.dayOff")} className="grid grid-cols-2 gap-3">
        <off.TextField name="day" label={say("shopSetup.hours.dayOff")} placeholder="2026-12-24" inputMode="numeric" />
        <off.TextField name="reason" label={say("shopSetup.hours.dayOffReason")} />
        <div className="col-span-2 flex flex-col gap-3">
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          <off.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">
            {say("shopSetup.hours.dayOffAdd")}
          </off.Submit>
        </div>
      </off.Form>
    </Card.Root>
  );
}

const num = z.string().regex(/^\d{1,5}$/);
const rulesForm = createKrizakaForm({
  schema: z.object({ cancellationHours: num, bookingHorizonDays: num, slotStepMinutes: num, minNoticeMinutes: num, reportLinkDays: num, paymentTermsDays: num }),
  defaultValues: { cancellationHours: "24", bookingHorizonDays: "60", slotStepMinutes: "30", minNoticeMinutes: "120", reportLinkDays: "30", paymentTermsDays: "30" },
});

function RulesCard({ rules }: { rules: NonNullable<SetupData["rules"]> }) {
  const { say, locale } = useSay();
  const { visitReports } = useVocabulary();
  const call = useCall();
  const [saved, setSaved] = useState(false);
  const form = rulesForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    defaultValues: Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as never,
    onSubmit: async (values) => {
      setSaved(false);
      const json = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]));
      setSaved((await call.run("/api/walker/rules", { json })) !== null);
    },
  });
  return (
    <Card.Root className="p-4 lg:col-span-2">
      <h2 className="mb-3 font-display text-base font-bold text-fg">{say("shopSetup.rules.title")}</h2>
      <form.Form aria-label={say("shopSetup.rules.title")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <form.TextField name="cancellationHours" label={say("shopSetup.rules.cancellationHours")} inputMode="numeric" />
        <form.TextField name="bookingHorizonDays" label={say("shopSetup.rules.bookingHorizonDays")} inputMode="numeric" />
        <form.TextField name="slotStepMinutes" label={say("shopSetup.rules.slotStepMinutes")} inputMode="numeric" />
        <form.TextField name="minNoticeMinutes" label={say("shopSetup.rules.minNoticeMinutes")} inputMode="numeric" />
        {visitReports ? <form.TextField name="reportLinkDays" label={say("shopSetup.rules.reportLinkDays")} inputMode="numeric" /> : null}
        <form.TextField name="paymentTermsDays" label={say("shopSetup.rules.paymentTermsDays")} inputMode="numeric" />
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          {saved ? <Alert tone="success">{say("shopSetup.rules.saved")}</Alert> : null}
          <form.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">
            {say("shopSetup.rules.submit")}
          </form.Submit>
        </div>
      </form.Form>
    </Card.Root>
  );
}
