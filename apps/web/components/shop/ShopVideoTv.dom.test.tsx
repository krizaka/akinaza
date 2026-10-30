// @vitest-environment jsdom
import type { RetroTvProps } from "@krizaka/ui/retro-tv";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberedSound, ShopVideoTv, SOUND_KEY, type TvProgramme } from "./ShopVideoTv";

const seen: RetroTvProps[] = [];
vi.mock("@krizaka/ui/retro-tv", () => ({
  RetroTv: (props: RetroTvProps) => {
    seen.push(props);
    return <div data-testid="tv">{props.playlist?.map((p) => <div key={p.id} data-testid="programme">{p.src ? <video src={p.src} /> : props.renderEmbed?.(p)}</div>)}</div>;
  },
}));
vi.mock("@krizaka/ui/page", () => ({ Section: ({ children }: { children: ReactNode }) => <section>{children}</section> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels = { play: "Play", pause: "Pause", next: "Next", previous: "Previous", soundOff: "Sound off", soundOn: "Sound on", captions: "Captions", seek: "Seek", nowPlaying: "Now" };
const playLabels = { tiktok: "Load TikTok and play", "youtube-shorts": "Load YouTube and play", instagram: "Load Instagram and play" };
const playlist: TvProgramme[] = [
  { id: "a", title: "First", src: "https://cdn.test/a.mp4", poster: "https://cdn.test/a.jpg" },
  { id: "b", title: "A public Short", platform: "youtube-shorts", url: "https://www.youtube.com/shorts/sOpin6X2--0" },
  { id: "c", title: "Third", src: "https://cdn.test/c.mp4" },
];

async function draw(transition: "channel" | "crossfade" | "slide" = "channel") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<ShopVideoTv title="Videos" playlist={playlist} transition={transition} label="Videos of the shop" channel="Latest" labels={labels} playLabels={playLabels} notice="Platform sees your visit." />));
  return { host, last: () => seen.at(-1)!, done: () => { act(() => root.unmount()); host.remove(); } };
}

describe("the shop's television (#469)", () => {
  beforeEach(() => { seen.length = 0; localStorage.clear(); });
  afterEach(() => localStorage.clear());

  it("plays the owner's videos in their order, with their transition, then again (the set loops its playlist)", async () => {
    const tv = await draw("slide");
    expect(tv.last().playlist?.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(tv.last().transition).toBe("slide");
    tv.done();
  });

  it("starts muted and plays by itself, since a browser refuses sound without a press", async () => {
    const tv = await draw();
    expect(tv.last().muted).toBe(true);
    expect(tv.last().autoPlay).toBe(true);
    tv.done();
  });

  it("remembers the sound the visitor chose, and then waits for their press instead of playing with sound by itself", async () => {
    const tv = await draw();
    act(() => tv.last().onMutedChange?.(false));
    expect(localStorage.getItem(SOUND_KEY)).toBe("on");
    act(() => tv.last().onMutedChange?.(true));
    expect(localStorage.getItem(SOUND_KEY)).toBe("off");
    tv.done();
    localStorage.setItem(SOUND_KEY, "on");
    seen.length = 0;
    const next = await draw();
    expect(next.last().muted).toBe(false);
    expect(next.last().autoPlay).toBe(false);
    next.done();
  });

  it("works when the browser keeps no storage", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(rememberedSound()).toBeNull();
    get.mockRestore();
  });

  it("keeps a platform's video behind its button: no frame from the platform before the click", async () => {
    const tv = await draw();
    expect(tv.host.querySelector("iframe")).toBeNull();
    expect(tv.host.textContent).toContain("Load YouTube and play");
    expect(tv.host.textContent).toContain("Platform sees your visit.");
    tv.done();
  });
});
