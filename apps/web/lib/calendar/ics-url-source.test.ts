import { CalendarSourceError } from "@akinaza/core";
import { describe, expect, it, vi } from "vitest";

import { icsUrlSource } from "./ics-url-source";

const ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Secret title\r\nDTSTART:20261027T140000Z\r\nDTEND:20261027T150000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
const range = { from: new Date("2026-10-26T00:00:00Z"), to: new Date("2026-12-26T00:00:00Z") };
const none = { etag: null, lastModified: null };
const make = (answer: (req: Request | URL, init?: RequestInit) => Response | Promise<Response>, url = "webcal://calendar.example.com/me.ics") => {
  const fetch = vi.fn(async (req: Request | URL, init?: RequestInit) => answer(req, init)) as unknown as typeof globalThis.fetch;
  return { fetch, source: icsUrlSource({ url, timezone: "America/Toronto", fetch, resolve: async () => ["8.8.8.8"] }) };
};

describe("the ICS URL source (ADR-004)", () => {
  it("reads busy times (never the title) and hands back the validators", async () => {
    const { source } = make(() => new Response(ICS, { headers: { etag: '"v1"', "last-modified": "Mon, 26 Oct 2026 12:00:00 GMT" } }));
    const result = await source.busy(range, none);
    expect(result).toMatchObject({ changed: true, validators: { etag: '"v1"', lastModified: "Mon, 26 Oct 2026 12:00:00 GMT" } });
    expect(result.changed && result.busy).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Secret");
  });

  it("sends the validators back and takes a 304 as « nothing moved »", async () => {
    const { source, fetch } = make(() => new Response(null, { status: 304 }));
    expect(await source.busy(range, { etag: '"v1"', lastModified: "Mon, 26 Oct 2026 12:00:00 GMT" })).toEqual({ changed: false });
    const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({ "if-none-match": '"v1"', "if-modified-since": "Mon, 26 Oct 2026 12:00:00 GMT" });
  });

  it("follows a few redirects, re-checking each address, and refuses a redirect to a private one", async () => {
    let n = 0;
    const { source } = make(() => (n++ === 0 ? new Response(null, { status: 302, headers: { location: "https://cdn.example.com/me.ics" } }) : new Response(ICS)));
    expect((await source.busy(range, none)).changed).toBe(true);
    const bad = make(() => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }));
    await expect(bad.source.busy(range, none)).rejects.toMatchObject({ code: "AK_CAL_INVALID" });
    const loop = make(() => new Response(null, { status: 302, headers: { location: "https://calendar.example.com/me.ics" } }));
    await expect(loop.source.busy(range, none)).rejects.toMatchObject({ code: "AK_CAL_UNREACHABLE" });
  });

  it("names what went wrong, and what is worth retrying", async () => {
    const code = async (status: number) => {
      try {
        await make(() => new Response("x", { status })).source.busy(range, none);
      } catch (e) {
        return [(e as CalendarSourceError).code, (e as CalendarSourceError).retryable];
      }
      return null;
    };
    expect(await code(404)).toEqual(["AK_CAL_REFUSED", false]);
    expect(await code(403)).toEqual(["AK_CAL_REFUSED", false]);
    expect(await code(429)).toEqual(["AK_CAL_RATE_LIMITED", true]);
    expect(await code(503)).toEqual(["AK_CAL_UNREACHABLE", true]);
    await expect(make(() => new Response("<html>login</html>")).source.busy(range, none)).rejects.toMatchObject({ code: "AK_CAL_INVALID" });
    await expect(make(() => { throw new TypeError("network"); }).source.busy(range, none)).rejects.toMatchObject({ code: "AK_CAL_UNREACHABLE", retryable: true });
  });

  it("stops reading a file that is too big, declared or not", async () => {
    await expect(make(() => new Response(ICS, { headers: { "content-length": "6000000" } })).source.busy(range, none)).rejects.toMatchObject({ code: "AK_CAL_TOO_LARGE" });
    const huge = new Response(new ReadableStream({ start(c) { for (let i = 0; i < 7; i++) c.enqueue(new Uint8Array(1_000_000)); c.close(); } }));
    await expect(make(() => huge).source.busy(range, none)).rejects.toMatchObject({ code: "AK_CAL_TOO_LARGE" });
  });
});
