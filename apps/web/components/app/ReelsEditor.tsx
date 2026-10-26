"use client";

import { SOCIAL_PLATFORMS, type SocialPlatform } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { shrinkImage, STOREFRONT_LONG_SIDE } from "@/lib/shrink-image";

export interface ReelLine {
  id: string;
  kind: "upload" | "external";
  platform: "tiktok" | "youtube-shorts" | "instagram" | null;
  titleFr: string;
  titleEn: string;
  externalUrl: string | null;
  seconds: number | null;
}

export interface ReelsEditorProps {
  reels: ReelLine[];
  links: Partial<Record<SocialPlatform, string>>;
  limits: { reelSeconds: number; reelMegabytes: number };
}

// @fixed: the largest video the phone may hand to the page before the administrator's own limit answers (the form only keeps a file from being absurd).
const MAX_PICK_BYTES = 600 * 1024 * 1024;
// @fixed: the largest picture of a poster before it is redrawn small.
const MAX_POSTER_BYTES = 25 * 1024 * 1024;

const linkForm = createKrizakaForm({
  schema: z.object({ url: z.string().min(1).max(300), titleFr: z.string().max(60), titleEn: z.string().max(60) }),
  defaultValues: { url: "", titleFr: "", titleEn: "" },
});
const uploadForm = createKrizakaForm({
  schema: z.object({ titleFr: z.string().max(60), titleEn: z.string().max(60), videoFiles: z.array(z.custom<File>()).min(1).max(1), posterFiles: z.array(z.custom<File>()).max(1) }),
  defaultValues: { titleFr: "", titleEn: "", videoFiles: [] as File[], posterFiles: [] as File[] },
});
const linksForm = createKrizakaForm({
  schema: z.object({ instagram: z.string().max(300), tiktok: z.string().max(300), youtube: z.string().max(300), facebook: z.string().max(300) }),
  defaultValues: { instagram: "", tiktok: "", youtube: "", facebook: "" },
});

/** Boutique › Vidéo et profils (#312): the latest video of the page (an upload, or a link behind a facade) and the shop's plain profile links. */
export function ReelsEditor({ reels, links, limits }: ReelsEditorProps) {
  const { say, locale } = useSay();
  const call = useCall();
  const [done, setDone] = useState<"reel" | "links" | null>(null);
  const i18n = { t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale };
  const titleOf = (r: ReelLine) => ({ fr: r.titleFr || r.titleEn, en: r.titleEn || r.titleFr })[locale] || (r.platform ? say(`studio.reels.platforms.${r.platform}`) : say(`studio.reels.kinds.${r.kind}`));

  const link = linkForm.useForm({
    i18n,
    onSubmit: async (v) => {
      setDone(null);
      if ((await call.run("/api/walker/reels", { json: v })) !== null) { setDone("reel"); link.reset(); }
    },
  });
  const upload = uploadForm.useForm({
    i18n,
    onSubmit: async (v) => {
      setDone(null);
      const body = new FormData();
      body.set("video", v.videoFiles[0]!);
      const poster = v.posterFiles[0];
      if (poster) body.set("poster", await shrinkImage(poster, STOREFRONT_LONG_SIDE), "poster.jpg");
      body.set("titleFr", v.titleFr);
      body.set("titleEn", v.titleEn);
      if ((await call.run("/api/walker/reels/upload", { body })) !== null) { setDone("reel"); upload.reset(); }
    },
  });
  const profiles = linksForm.useForm({
    i18n,
    defaultValues: { instagram: links.instagram ?? "", tiktok: links.tiktok ?? "", youtube: links.youtube ?? "", facebook: links.facebook ?? "" },
    onSubmit: async (v) => {
      setDone(null);
      const json = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, v[p].trim() === "" ? null : v[p].trim()]));
      if ((await call.run("/api/walker/social-links", { method: "PUT", json })) !== null) setDone("links");
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card.Root className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="font-display text-base font-bold text-fg">{say("studio.reels.title")}</h2>
          <p className="m-0 text-sm text-fg-secondary">{say("studio.reels.lead")}</p>
        </div>
        {reels.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("studio.reels.none")}</p> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {reels.map((r, index) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default p-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="break-words text-sm font-semibold text-fg">{titleOf(r)}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-fg-secondary">
                    <Badge tone="neutral" size="sm">{say(`studio.reels.kinds.${r.kind}`)}</Badge>
                    {index === 0 ? <Badge tone="success" size="sm">{say("studio.reels.shown")}</Badge> : null}
                  </span>
                </span>
                <Button variant="ghost" size="md" disabled={call.pending} onClick={() => void call.run(`/api/walker/reels/${r.id}`, { method: "DELETE" })}>{say("studio.reels.remove")}</Button>
              </li>
            ))}
          </ul>
        )}
        <upload.Form aria-label={say("studio.reels.upload")} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <upload.FileUpload name="videoFiles" label={say("studio.reels.upload")} title={say("studio.reels.uploadTitle")} browseLabel={say("shopSetup.media.browse")} hint={say("studio.reels.uploadHint", limits.reelSeconds === undefined ? {} : { seconds: limits.reelSeconds, megabytes: limits.reelMegabytes })} accept="video/mp4,video/webm" maxSize={MAX_PICK_BYTES} maxFiles={1} removeLabel={(name) => say("shopSetup.media.remove", { name })} refusalLabel={(r) => say("shopSetup.media.tooBig", { name: r.file.name })} />
          </div>
          <div className="sm:col-span-2">
            <upload.FileUpload name="posterFiles" label={say("studio.reels.poster")} title={say("studio.reels.posterTitle")} browseLabel={say("shopSetup.media.browse")} hint={say("shopSetup.media.uploadHint")} accept="image/*" maxSize={MAX_POSTER_BYTES} maxFiles={1} removeLabel={(name) => say("shopSetup.media.remove", { name })} refusalLabel={(r) => say("shopSetup.media.tooBig", { name: r.file.name })} />
          </div>
          <upload.TextField name="titleFr" label={say("studio.reels.titleFr")} />
          <upload.TextField name="titleEn" label={say("studio.reels.titleEn")} />
          <upload.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">{say("studio.reels.upload")}</upload.Submit>
        </upload.Form>
        <link.Form aria-label={say("studio.reels.linkLabel")} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <link.TextField name="url" label={say("studio.reels.linkLabel")} hint={say("studio.reels.linkHint")} inputMode="url" autoComplete="off" />
          </div>
          <link.TextField name="titleFr" label={say("studio.reels.titleFr")} />
          <link.TextField name="titleEn" label={say("studio.reels.titleEn")} />
          <link.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">{say("studio.reels.addLink")}</link.Submit>
        </link.Form>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        {done === "reel" ? <Alert tone="success">{say("studio.reels.added")}</Alert> : null}
      </Card.Root>

      <Card.Root className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="font-display text-base font-bold text-fg">{say("studio.reels.socialTitle")}</h2>
          <p className="m-0 text-sm text-fg-secondary">{say("studio.reels.socialLead")}</p>
        </div>
        <profiles.Form aria-label={say("studio.reels.socialTitle")} className="grid gap-3 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((p) => <profiles.TextField key={p} name={p} label={say(`studio.reels.social.${p}`)} hint={say("studio.reels.socialHint")} inputMode="url" autoComplete="off" />)}
          <div className="flex flex-col gap-3 sm:col-span-2">
            {done === "links" ? <Alert tone="success">{say("studio.reels.linksSaved")}</Alert> : null}
            <profiles.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">{say("studio.reels.saveLinks")}</profiles.Submit>
          </div>
        </profiles.Form>
      </Card.Root>
    </div>
  );
}
