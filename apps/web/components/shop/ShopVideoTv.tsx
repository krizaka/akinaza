"use client";

import type { ReelTransition } from "@akinaza/core";
import { EmbedFacade, type EmbedPlatform } from "@krizaka/ui/embed-facade";
import { Section } from "@krizaka/ui/page";
import { RetroTv, type RetroTvLabels, type RetroTvSource } from "@krizaka/ui/retro-tv";
import { type ReactNode, useState } from "react";

/** One programme of the shop's television: the shop's own video (`src`), or a link to a platform's short video (behind its facade). */
export interface TvProgramme {
  id: string;
  title: string;
  src?: string;
  poster?: string;
  platform?: EmbedPlatform;
  url?: string;
}

export interface ShopVideoTvProps {
  id?: string;
  "data-shop-key"?: string;
  title: ReactNode;
  lead?: ReactNode;
  playlist: readonly TvProgramme[];
  transition: ReelTransition;
  /** The television's accessible name (« Videos of {shop} »). */
  label: string;
  /** The channel written on the cabinet. */
  channel: string;
  labels: RetroTvLabels;
  playLabels: Record<EmbedPlatform, string>;
  notice: ReactNode;
}

export const SOUND_KEY = "kz-shop-tv-sound";

/** The visitor's last choice about the sound (« on » only after they pressed the button), or null. Storage can be blocked: the page works without it. */
export function rememberedSound(): "on" | "off" | null {
  try {
    const v = globalThis.localStorage?.getItem(SOUND_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

function rememberSound(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the choice simply is not kept.
  }
}

/**
 * The shop's short videos (akinaza#469): one large television that plays the owner's playlist in their order, then again, with the owner's transition (a cut
 * under reduced motion, which the television decides). The sound starts off: a browser refuses sound without a gesture, so a visitor who kept the sound on
 * last time finds the set not playing by itself, and starts it with their own press. A link to a platform stays behind its facade until the visitor clicks.
 */
export function ShopVideoTv({ id, title, lead, playlist, transition, label, channel, labels, playLabels, notice, ...rest }: Readonly<ShopVideoTvProps>) {
  // Read once, on the client only: the section is drawn after hydration (`ShopVideoLazy`).
  const [sound] = useState(rememberedSound);
  const wantsSound = sound === "on";
  const byId = new Map(playlist.map((p) => [p.id, p]));
  const sources: RetroTvSource[] = playlist.map((p) => ({ id: p.id, title: p.title, src: p.src, poster: p.poster }));
  const embed = (source: RetroTvSource): ReactNode => {
    const p = byId.get(source.id);
    if (!p?.platform || !p.url) {
      return null;
    }
    return <EmbedFacade platform={p.platform} url={p.url} title={p.title} playLabel={playLabels[p.platform]} poster={p.poster} notice={notice} />;
  };
  return (
    <Section id={id} title={title} lead={lead} data-variant="tv" data-shop-key={rest["data-shop-key"]}>
      <div data-shop-tv="" className="mx-auto w-full max-w-4xl">
        <RetroTv
          title={label}
          channel={channel}
          playlist={sources}
          transition={transition}
          renderEmbed={embed}
          labels={labels}
          muted={!wantsSound}
          autoPlay={!wantsSound}
          preload="none"
          onMutedChange={(muted) => rememberSound(!muted)}
        />
      </div>
    </Section>
  );
}
