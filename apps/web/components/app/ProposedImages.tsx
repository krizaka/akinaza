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
import { addPhoto, adoptCover, mediaPayload, type MediaState } from "@/lib/proposed-media";

export interface ProposedImagesData {
  config: ShopPageConfig;
  /** The trade in force: the owner's choice, else the one derived from the business type. */
  shopType: ShopType;
  /** The trades the administrator offers, with their proposals. */
  proposals: Partial<Record<ShopType, Proposals>>;
  media: MediaState;
}

/** « Images proposées »: the owner picks the trade, chooses a proposed cover or photos in one click, or turns the proposals off. They are neutral pictures, never presented as the shop. */
export function ProposedImages({ data }: { data: ProposedImagesData }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [type, setType] = useState<ShopType>(data.shopType);
  const [show, setShow] = useState(data.config.useDefaults ?? true);
  const [saved, setSaved] = useState(false);
  // The media as last saved from here, valid until the server sends a fresh snapshot (after its refresh): a second adoption never starts from what the first one replaced.
  const [local, setLocal] = useState<{ base: MediaState; media: MediaState } | null>(null);
  const media = local && local.base === data.media ? local.media : data.media;
  const t = (key: string) => say(`shopSetup.defaults.${key}`);
  const offered = Object.keys(data.proposals) as ShopType[];
  const current = data.proposals[type];
  // Only what this card changes: the sections and the logo of the look card stay as they are on the server.
  const savePage = async (next: { shopType?: ShopType; useDefaults?: boolean }) => {
    setSaved(false);
    setSaved((await call.run("/api/walker/shop-page", { json: next })) !== null);
  };
  const saveMedia = async (next: MediaState) => {
    setSaved(false);
    if ((await call.run("/api/walker/media", { json: mediaPayload(next) })) === null) return;
    setLocal({ base: data.media, media: next });
    setSaved(true);
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
          {/* The trade in force stays visible (and selectable only when the administrator offers it), so choosing an offered trade is a change the select reports. */}
          {offered.includes(type) ? null : <option value={type} disabled>{t(`types.${type}`)}</option>}
          {offered.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
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
                {/* Keyed by the proposal, so a change of trade loads its own loop; played only when the owner asks (native controls), still otherwise. */}
                <video key={current.cover.id} className="aspect-video w-full rounded-lg object-cover" poster={current.cover.src} controls muted loop playsInline preload="metadata" aria-label={t("preview")}>
                  <source src={current.cover.webm} type="video/webm" />
                  <source src={current.cover.mp4} type="video/mp4" />
                </video>
                <Button size="sm" variant="secondary" className="self-start" disabled={call.pending} onClick={() => void saveMedia(adoptCover(media, current.cover!))}>{t("useCover")}</Button>
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
                  <Button size="sm" variant="secondary" disabled={call.pending} onClick={() => void saveMedia(addPhoto(media, p))}>{t("addPhoto")}</Button>
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
