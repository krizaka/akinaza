import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { FeedAddress } from "./FeedAddress";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

const say = (key: string, vars?: Record<string, string | number>) => {
  const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en.console) as string;
  return vars ? Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), value) : value;
};
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say, locale: "en" }) }));

const url = "https://akinaza.example/api/feed/kf1.abcdef.ics";

describe("the private feed address, shown once after rotating (#282)", () => {
  const html = renderToStaticMarkup(<FeedAddress id="feed-shop" name="Julie" url={url} />);

  it("shows the link, « Copy the link » and the QR code with its accessible name", () => {
    expect(html).toContain(`value="${url}"`);
    expect(html).toContain("Copy the link");
    expect(html).toMatch(/<svg[^>]*role="img"/);
    expect(html).toContain("QR code of the private calendar link for Julie");
  });

  it("draws the QR from the address only: another address gives another code, none is sent anywhere", () => {
    const other = renderToStaticMarkup(<FeedAddress id="feed-shop" name="Julie" url={`${url}x`} />);
    const path = (h: string) => /<path[^>]*d="([^"]+)"/.exec(h)?.[1];
    expect(path(html)).toBeTruthy();
    expect(path(other)).not.toEqual(path(html));
    expect(html).not.toMatch(/<img|src=|href=/);
  });

  it("has the QR words in French too", () => {
    expect(fr.console.boutique.agenda.feed.qrLabel).toContain("{name}");
  });
});
