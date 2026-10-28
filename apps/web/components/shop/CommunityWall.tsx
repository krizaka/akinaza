"use client";


import { WALL_KIND, type WallTexture } from "@akinaza/core";
import { EmbedFacade } from "@krizaka/ui/embed-facade";
import { RetroTv, type RetroTvLabels } from "@krizaka/ui/retro-tv";
import { Wall, type WallItem } from "@krizaka/ui/wall";
import Image from "next/image";

import type { VideoView, WallPiece } from "@/lib/community-view";

/** The words of the video player, plain strings from the catalogue (the player wants functions, built here: a server component cannot hand them down). */
export interface PlayerWords {
  play: string;
  pause: string;
  mute: string;
  unmute: string;
  volume: string;
  seek: string;
  speed: string;
  captionsOff: string;
  captionsOn: string;
  fullscreen: string;
  exitFullscreen: string;
  pictureInPicture: string;
  loading: string;
  error: string;
  retry: string;
  time: string;
}

/** The television's own words (@krizaka/ui 3.70: `RetroTv.labels` are the cabinet's, no longer the player's). */
const tvLabels = (w: PlayerWords): Partial<RetroTvLabels> => ({ play: w.play, pause: w.pause, seek: w.seek, soundOff: w.unmute, soundOn: w.mute });

export interface FacadeWords {
  /** « Load {platform} and play » and the line under it, with the platform already named. */
  play: Record<string, string>;
  notice: Record<string, string>;
  elsewhereTitle: string;
}

const itemOf = (piece: WallPiece, name: string): WallItem => {
  const place = { id: piece.id, x: piece.x, y: piece.y, rotation: piece.rotation, z: piece.z };
  if (piece.kind === WALL_KIND.polaroid) {
    return {
      ...place,
      kind: "polaroid",
      attachment: piece.attachment,
      caption: piece.caption || undefined,
      img: <Image src={piece.imageUrl ?? ""} alt={piece.alt} width={960} height={720} unoptimized loading="lazy" referrerPolicy="no-referrer" className="h-auto w-full" />,
    };
  }
  if (piece.kind === WALL_KIND.note) return { ...place, kind: "note", text: piece.text, signature: piece.signature || undefined, hold: piece.attachment, ink: "blue" };
  return { ...place, kind: "sign", variant: piece.variant, as: "p", children: name };
};

/** The television: the shop's own video plays at once; another channel's stays behind its facade until the visitor asks. */
export function ShopTv({ video, channel, title, player, facade, platformNames }: Readonly<{ video: VideoView; channel: string; title: string; player: PlayerWords; facade: FacadeWords; platformNames: Record<string, string> }>) {
  const src = video.mp4 ?? video.webm;
  if (video.platform && video.externalUrl) {
    return (
      <RetroTv title={title} channel={channel} labels={tvLabels(player)}>
        <EmbedFacade platform={video.platform} url={video.externalUrl} title={title} playLabel={facade.play[video.platform] ?? platformNames[video.platform] ?? ""} poster={video.poster ?? undefined} notice={facade.notice[video.platform]} />
      </RetroTv>
    );
  }
  return <RetroTv title={title} channel={channel} src={src ?? ""} type="file" poster={video.poster ?? undefined} labels={tvLabels(player)} />;
}

/** The wall: the owner's photos, words and sign over a real list, with the latest video in its television beside it. */
export function CommunityWall({ pieces, texture, name, label, tv }: Readonly<{ pieces: WallPiece[]; texture: WallTexture; name: string; label: string; tv?: React.ReactNode }>) {
  return (
    <div className={tv ? "grid items-start gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]" : undefined}>
      {pieces.length > 0 ? <Wall aria-label={label} texture={texture} items={pieces.map((p) => itemOf(p, name))} /> : null}
      {tv ? <div className="mx-auto w-full max-w-xs">{tv}</div> : null}
    </div>
  );
}

/** Other channels' videos, each behind its facade: nothing is requested from the platform before the visitor presses play. */
export function ElsewhereVideos({ videos, facade, label }: Readonly<{ videos: VideoView[]; facade: FacadeWords; label: string }>) {
  return (
    <ul aria-label={label} className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {videos.map((v) => (
        <li key={v.id} className="aspect-[9/12] max-h-[34rem] overflow-hidden border border-border-default bg-surface-1">
          {v.platform && v.externalUrl ? (
            <EmbedFacade platform={v.platform} url={v.externalUrl} title={facade.elsewhereTitle.replace("{title}", v.title)} playLabel={facade.play[v.platform] ?? ""} poster={v.poster ?? undefined} notice={facade.notice[v.platform]} aspectRatio="9 / 12" />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
