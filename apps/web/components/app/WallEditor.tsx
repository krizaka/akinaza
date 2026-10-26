"use client";

import { WALL_LIMITS, WALL_TEXTURES, type WallItem, type WallTexture } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Field, Input, Select, Textarea } from "@krizaka/ui/field";
import { Slider } from "@krizaka/ui/slider";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";
import { shrinkImage, STOREFRONT_LONG_SIDE } from "@/lib/shrink-image";
import { clampPlace, nextPlace, nudge } from "@/lib/wall-editor";

type Piece = WallItem & { id: string };

export interface WallEditorProps {
  wall: { texture: WallTexture; items: Piece[] };
  limits: { wallItems: number; drawn: number };
}

function Labeled({ label, hint, children }: Readonly<{ label: string; hint?: string; children: (id: string) => React.ReactNode }>) {
  const id = useId();
  return (
    <Field.Root>
      <Field.Label htmlFor={id}>{label}</Field.Label>
      {children(id)}
      {hint ? <Field.Hint>{hint}</Field.Hint> : null}
    </Field.Root>
  );
}

const withoutId = (piece: Piece): WallItem => {
  const item: Partial<Piece> = { ...piece };
  delete item.id;
  return item as WallItem;
};

/**
 * Boutique › Le mur (#311): the owner pins photos, cards and the sign. The stage shows the layout; a piece is selected and moved with the
 * arrow keys (Shift for larger steps), tilted with [ and ], layered with Page Up and Page Down - or with the sliders. No drag is needed, and
 * nothing leaves the bounds the server enforces. One save sends the whole wall.
 */
export function WallEditor({ wall, limits }: Readonly<WallEditorProps>) {
  const { say } = useSay();
  const call = useCall();
  const [texture, setTexture] = useState<WallTexture>(wall.texture);
  const [items, setItems] = useState<Piece[]>(wall.items);
  const [selected, setSelected] = useState<string | null>(wall.items[0]?.id ?? null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [announce, setAnnounce] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const current = items.find((i) => i.id === selected) ?? null;
  const full = items.length >= limits.wallItems;
  const kindName = (item: Piece) => say(`studio.wall.kinds.${item.kind}`);
  const nameOf = (item: Piece) => say("studio.wall.piece", { kind: kindName(item), n: items.indexOf(item) + 1 });

  const change = (id: string, next: Partial<Piece> | ((item: Piece) => Piece)) => {
    setSaved(false);
    const apply = (item: Piece): Piece => (typeof next === "function" ? next(item) : ({ ...item, ...next } as Piece));
    setItems((all) => all.map((item) => (item.id === id ? apply(item) : item)));
  };
  const move = (item: Piece, key: string, shift: boolean): boolean => {
    const moved = nudge(item, key, shift);
    if (!moved) return false;
    change(item.id, moved as Piece);
    setAnnounce(say("studio.wall.moved", { x: Math.round(moved.x), y: Math.round(moved.y), rotation: moved.rotation }));
    return true;
  };
  const add = (item: WallItem) => {
    const id = `new-${crypto.randomUUID()}`;
    setItems((all) => [...all, { ...item, id } as Piece]);
    setSelected(id);
    setSaved(false);
  };
  const addNote = () => add({ kind: "note", ...nextPlace(items.length), attachment: "pin", textFr: "", textEn: "", signature: "" });
  const addSign = () => add({ kind: "sign", ...nextPlace(items.length), rotation: 0, variant: "enamel" });
  const addPhoto = async (picked: File | undefined) => {
    if (!picked) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", await shrinkImage(picked, STOREFRONT_LONG_SIDE), "photo.jpg");
      body.set("purpose", "wall");
      const uploaded = await call.run<{ url: string }>("/api/walker/media/upload", { body }, { refresh: false });
      if (uploaded) add({ kind: "polaroid", ...nextPlace(items.length), attachment: "tape", imageUrl: uploaded.url, altFr: "", altEn: "", captionFr: "", captionEn: "" });
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };
  const remove = (id: string) => {
    setItems((all) => all.filter((i) => i.id !== id));
    setSelected(items.find((i) => i.id !== id)?.id ?? null);
    setSaved(false);
  };
  const save = async () => {
    setSaved(false);
    const done = await call.run("/api/walker/wall", { method: "PUT", json: { texture, items: items.map((i) => withoutId(clampPlace(i))) } });
    setSaved(done !== null);
  };
  const drawnOrder = [...items].sort((a, b) => a.z - b.z);

  return (
    <Card.Root className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-base font-bold text-fg">{say("studio.wall.title")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{say("studio.wall.lead")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label={say("studio.wall.texture")}>
          {(id) => (
            <Select id={id} value={texture} onChange={(e) => { setTexture(e.target.value as WallTexture); setSaved(false); }}>
              {WALL_TEXTURES.map((t) => <option key={t} value={t}>{say(`studio.wall.textures.${t}`)}</option>)}
            </Select>
          )}
        </Labeled>
        <p className="m-0 self-end text-sm text-fg-secondary" data-testid="wall-count">{say("studio.wall.count", { count: items.length, max: limits.wallItems })}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={say("studio.wall.uploadTitle")} tabIndex={-1} onChange={(e) => void addPhoto(e.target.files?.[0])} />
        <Button variant="secondary" size="md" disabled={full || uploading} onClick={() => file.current?.click()}>{uploading ? say("studio.wall.uploading") : say("studio.wall.addPhoto")}</Button>
        <Button variant="secondary" size="md" disabled={full} onClick={addNote}>{say("studio.wall.addNote")}</Button>
        <Button variant="secondary" size="md" disabled={full || items.some((i) => i.kind === "sign")} onClick={addSign}>{say("studio.wall.addSign")}</Button>
      </div>
      {items.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("studio.wall.empty")}</p> : null}
      <fieldset
        aria-label={say("studio.wall.stage")}
        data-texture={texture}
        className="relative m-0 aspect-video w-full min-w-0 overflow-hidden rounded-lg border border-border-default bg-surface-2 p-0"
      >
        {drawnOrder.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === selected}
            aria-label={nameOf(item)}
            data-piece={item.kind}
            onClick={() => setSelected(item.id)}
            onFocus={() => setSelected(item.id)}
            onKeyDown={(e) => { if (move(item, e.key, e.shiftKey)) e.preventDefault(); }}
            className="absolute flex min-h-11 min-w-11 items-center justify-center overflow-hidden border border-border-strong bg-surface-1 text-xs font-semibold text-fg shadow-sm outline-offset-2 aria-pressed:ring-2 aria-pressed:ring-accent"
            style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-0%, -0%) rotate(${item.rotation}deg)`, zIndex: item.z, width: item.kind === "polaroid" ? "16%" : "14%" }}
          >
            {item.kind === "polaroid" && item.imageUrl ? <Image src={item.imageUrl} alt="" width={160} height={120} unoptimized className="aspect-[4/3] w-full object-cover" /> : <span className="p-1">{kindName(item)}</span>}
          </button>
        ))}
      </fieldset>
      <p className="m-0 text-xs text-fg-secondary" id="wall-keys">{say("studio.wall.keys")}</p>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {items.length > limits.drawn ? <Alert tone="info">{say("studio.wall.drawn", { drawn: limits.drawn })}</Alert> : null}

      {items.length ? (
        <ol aria-label={say("studio.wall.pieces")} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {items.map((item) => (
            <li key={item.id}>
              <Button variant={item.id === selected ? "primary" : "ghost"} size="md" aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{nameOf(item)}</Button>
            </li>
          ))}
        </ol>
      ) : null}

      {current ? (
        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2" aria-label={nameOf(current)}>
          <Labeled label={say("studio.wall.x")}>
            {(id) => <Slider id={id} label={say("studio.wall.x")} min={0} max={100} step={1} value={current.x} onValueChange={(v: number) => change(current.id, { x: v })} />}
          </Labeled>
          <Labeled label={say("studio.wall.y")}>
            {(id) => <Slider id={id} label={say("studio.wall.y")} min={0} max={100} step={1} value={current.y} onValueChange={(v: number) => change(current.id, { y: v })} />}
          </Labeled>
          {current.kind !== "sign" ? (
            <Labeled label={say("studio.wall.rotation")}>
              {(id) => <Slider id={id} label={say("studio.wall.rotation")} min={-WALL_LIMITS.tilt} max={WALL_LIMITS.tilt} step={1} value={current.rotation} onValueChange={(v: number) => change(current.id, { rotation: v })} />}
            </Labeled>
          ) : null}
          <Labeled label={say("studio.wall.layer")}>
            {(id) => <Input id={id} type="number" inputMode="numeric" min={0} max={WALL_LIMITS.order} value={current.z} onChange={(e) => change(current.id, { z: Math.round(Number(e.target.value)) })} />}
          </Labeled>
          {current.kind === "polaroid" ? (
            <>
              <Labeled label={say("studio.wall.altFr")}>{(id) => <Input id={id} lang="fr" maxLength={WALL_LIMITS.alt} value={current.altFr} onChange={(e) => change(current.id, { altFr: e.target.value })} />}</Labeled>
              <Labeled label={say("studio.wall.altEn")}>{(id) => <Input id={id} lang="en" maxLength={WALL_LIMITS.alt} value={current.altEn} onChange={(e) => change(current.id, { altEn: e.target.value })} />}</Labeled>
              <Labeled label={say("studio.wall.captionFr")}>{(id) => <Input id={id} lang="fr" maxLength={WALL_LIMITS.caption} value={current.captionFr} onChange={(e) => change(current.id, { captionFr: e.target.value })} />}</Labeled>
              <Labeled label={say("studio.wall.captionEn")}>{(id) => <Input id={id} lang="en" maxLength={WALL_LIMITS.caption} value={current.captionEn} onChange={(e) => change(current.id, { captionEn: e.target.value })} />}</Labeled>
            </>
          ) : null}
          {current.kind === "note" ? (
            <>
              <Labeled label={say("studio.wall.textFr")}>{(id) => <Textarea id={id} lang="fr" rows={3} maxLength={WALL_LIMITS.note} value={current.textFr} onChange={(e) => change(current.id, { textFr: e.target.value })} />}</Labeled>
              <Labeled label={say("studio.wall.textEn")}>{(id) => <Textarea id={id} lang="en" rows={3} maxLength={WALL_LIMITS.note} value={current.textEn} onChange={(e) => change(current.id, { textEn: e.target.value })} />}</Labeled>
              <Labeled label={say("studio.wall.signature")}>{(id) => <Input id={id} maxLength={WALL_LIMITS.signature} value={current.signature} onChange={(e) => change(current.id, { signature: e.target.value })} />}</Labeled>
            </>
          ) : null}
          {current.kind !== "sign" ? (
            <Labeled label={say("studio.wall.attachment")}>
              {(id) => (
                <Select id={id} value={current.attachment} onChange={(e) => change(current.id, { attachment: e.target.value as "tape" | "pin" })}>
                  {(["tape", "pin"] as const).map((a) => <option key={a} value={a}>{say(`studio.wall.attachments.${a}`)}</option>)}
                </Select>
              )}
            </Labeled>
          ) : (
            <Labeled label={say("studio.wall.variant")} hint={say("studio.wall.signNote")}>
              {(id) => (
                <Select id={id} value={current.variant} onChange={(e) => change(current.id, { variant: e.target.value as "enamel" | "neon" | "painted" })}>
                  {(["enamel", "neon", "painted"] as const).map((v) => <option key={v} value={v}>{say(`studio.wall.variants.${v}`)}</option>)}
                </Select>
              )}
            </Labeled>
          )}
          <div className="sm:col-span-2">
            <Button variant="ghost" size="md" onClick={() => remove(current.id)}>{say("studio.wall.remove")}</Button>
          </div>
        </fieldset>
      ) : null}

      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {saved ? <Alert tone="success">{say("studio.wall.saved")}</Alert> : null}
      <Button variant="primary" size="md" className="w-full sm:w-auto sm:self-start" disabled={call.pending} onClick={() => void save()}>{say("studio.wall.save")}</Button>
    </Card.Root>
  );
}
