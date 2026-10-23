"use client";

import type { ShopType } from "@akinaza/core";
import type { ShopPageConfig } from "@akinaza/db";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Field, Select } from "@krizaka/ui/field";
import { Switch } from "@krizaka/ui/switch";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";
import type { Proposals } from "@/lib/default-media-proposals";
import { useSay } from "@/lib/i18n-client";
import type { GalleryLine } from "@/lib/storefront-form";

export interface ProposedImagesData {
  config: ShopPageConfig;
  /** The trade in force: the owner's choice, else the one derived from the business type. */
  shopType: ShopType;
  /** The trades the administrator offers, with their proposals. */
  proposals: Partial<Record<ShopType, Proposals>>;
  media: { cover: GalleryLine | null; gallery: GalleryLine[] };
}

/** « Images proposées »: the owner picks the trade, chooses a proposed cover or photos in one click, or turns the proposals off. They are neutral pictures, never presented as the shop. */
export function ProposedImages({ data }: { data: ProposedImagesData }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [type, setType] = useState<ShopType>(data.shopType);
  const [show, setShow] = useState(data.config.useDefaults ?? true);
  const [saved, setSaved] = useState(false);
  const t = (key: string) => say(`shopSetup.defaults.${key}`);
  const types = Object.keys(data.proposals) as ShopType[];
  const current = data.proposals[type];
  // Only what this card changes: the sections and the logo of the look card stay as they are on the server.
  const savePage = async (next: { shopType?: ShopType; useDefaults?: boolean }) => {
    setSaved(false);
    setSaved((await call.run("/api/walker/shop-page", { json: next })) !== null);
  };
  const saveMedia = async (cover: GalleryLine | null, gallery: GalleryLine[]) => {
    setSaved(false);
    setSaved((await call.run("/api/walker/media", { json: { cover, gallery } })) !== null);
  };
  return (
    <Card.Root className="flex flex-col gap-4 p-4 lg:col-span-2">
      <div>
        <h2 className="font-display text-base font-bold text-fg">{t("title")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{t("lead")}</p>
      </div>
      <Field.Root>
        <Field.Label htmlFor="shop-type">{t("type")}</Field.Label>
        <Select id="shop-type" value={type} onChange={(e) => { const next = e.target.value as ShopType; setType(next); void savePage({ shopType: next }); }}>
          {types.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
        </Select>
      </Field.Root>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-fg">{t("show")}</span>
        <Switch checked={show} onCheckedChange={(on) => { setShow(on); void savePage({ useDefaults: on }); }} label={t("show")} />
      </div>
      {current ? (
        <div className="flex flex-col gap-4">
          {current.cover ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold text-fg">{t("cover")}</h3>
              <figure className="m-0 flex flex-col gap-2 sm:max-w-md">
                <video className="aspect-video w-full rounded-lg object-cover" poster={current.cover.src} autoPlay muted loop playsInline aria-label={t("preview")}>
                  <source src={current.cover.webm} type="video/webm" />
                  <source src={current.cover.mp4} type="video/mp4" />
                </video>
                <Button size="sm" variant="secondary" className="self-start" disabled={call.pending} onClick={() => void saveMedia({ url: current.cover!.src, altFr: current.cover!.altFr, altEn: current.cover!.altEn, webmUrl: current.cover!.webm, mp4Url: current.cover!.mp4, wide: false } as GalleryLine, data.media.gallery)}>{t("useCover")}</Button>
              </figure>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-fg">{t("gallery")}</h3>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
              {current.gallery.map((p) => (
                <li key={p.id} className="flex flex-col gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={({ fr: p.altFr, en: p.altEn })[locale]} width={960} height={720} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <Button size="sm" variant="secondary" disabled={call.pending} onClick={() => void saveMedia(data.media.cover, [...data.media.gallery, { url: p.src, altFr: p.altFr, altEn: p.altEn, wide: false } as GalleryLine].slice(0, 12))}>{t("addPhoto")}</Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {saved ? <Alert tone="success">{t("saved")}</Alert> : null}
    </Card.Root>
  );
}
