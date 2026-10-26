"use client";

import { ANNOUNCEMENT_LIMITS, currentAnnouncements } from "@akinaza/core";
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

// @fixed: the largest picture taken from a phone before it is redrawn small (the storefront photos' own limit).
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export interface BoardFlyer {
  id: string;
  textFr: string;
  textEn: string;
  photoUrl: string | null;
  endsOn: string | null;
  createdAt: string;
}

const flyerForm = createKrizakaForm({
  schema: z.object({
    textFr: z.string().max(ANNOUNCEMENT_LIMITS.text),
    textEn: z.string().max(ANNOUNCEMENT_LIMITS.text),
    photoAlt: z.string().max(200),
    endsOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
    photoFiles: z.array(z.custom<File>()).max(1),
  }).refine((v) => v.textFr.trim().length + v.textEn.trim().length > 0, { path: ["textFr"], message: "required" }),
  defaultValues: { textFr: "", textEn: "", photoAlt: "", endsOn: "", photoFiles: [] as File[] },
});

/** Boutique › Le babillard (#314): the flyers pinned on the page - up to three at a time, the newest first, each down on its last day. */
export function BoardEditor({ flyers, today }: { flyers: BoardFlyer[]; /** The shop's local day, `YYYY-MM-DD`. */ today: string }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [saved, setSaved] = useState(false);
  const up = new Set(currentAnnouncements(flyers.map((f) => ({ ...f, createdAt: new Date(f.createdAt) })), today).map((f) => f.id));
  const form = flyerForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setSaved(false);
      let photoUrl: string | null = null;
      const photo = values.photoFiles[0];
      if (photo) {
        const body = new FormData();
        body.set("file", await shrinkImage(photo, STOREFRONT_LONG_SIDE), "photo.jpg");
        body.set("purpose", "announcements");
        const uploaded = await call.run<{ url: string }>("/api/walker/media/upload", { body }, { refresh: false });
        if (!uploaded) return;
        photoUrl = uploaded.url;
      }
      const done = await call.run("/api/walker/announcements", { json: { textFr: values.textFr, textEn: values.textEn, photoUrl, photoAlt: values.photoAlt, endsOn: values.endsOn || null } });
      if (done !== null) { setSaved(true); form.reset(); }
    },
  });
  return (
    <Card.Root className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-base font-bold text-fg">{say("studio.board.title")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{say("studio.board.lead")}</p>
      </div>
      {flyers.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("studio.board.none")}</p> : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {flyers.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border-default p-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 break-words text-sm text-fg">{({ fr: f.textFr || f.textEn, en: f.textEn || f.textFr })[locale]}</p>
                <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-secondary">
                  <Badge tone={up.has(f.id) ? "success" : "neutral"} size="sm">{say(up.has(f.id) ? "studio.board.upNow" : "studio.board.ended")}</Badge>
                  {f.endsOn ? <span>{f.endsOn}</span> : null}
                </p>
              </div>
              <Button variant="ghost" size="md" disabled={call.pending} onClick={() => void call.run(`/api/walker/announcements/${f.id}`, { method: "DELETE" })}>{say("studio.board.remove")}</Button>
            </li>
          ))}
        </ul>
      )}
      <form.Form aria-label={say("studio.board.add")} className="grid gap-3 sm:grid-cols-2">
        <form.TextArea name="textFr" label={say("studio.board.textFr")} hint={say("studio.board.max")} rows={3} />
        <form.TextArea name="textEn" label={say("studio.board.textEn")} hint={say("studio.board.max")} rows={3} />
        <form.TextField name="endsOn" label={say("studio.board.endsOn")} hint={say("studio.board.endsOnHint")} placeholder="2026-12-31" inputMode="numeric" />
        <form.TextField name="photoAlt" label={say("studio.board.photoAlt")} />
        <div className="sm:col-span-2">
          <form.FileUpload name="photoFiles" label={say("studio.board.photo")} title={say("studio.wall.uploadTitle")} browseLabel={say("shopSetup.media.browse")} hint={say("shopSetup.media.uploadHint")} accept="image/*" maxSize={MAX_PHOTO_BYTES} maxFiles={1} removeLabel={(name) => say("shopSetup.media.remove", { name })} refusalLabel={(r) => say("shopSetup.media.tooBig", { name: r.file.name })} />
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2">
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          {saved ? <Alert tone="success">{say("studio.board.saved")}</Alert> : null}
          <form.Submit size="md" className="w-full sm:w-auto sm:self-start">{say("studio.board.add")}</form.Submit>
        </div>
      </form.Form>
    </Card.Root>
  );
}
