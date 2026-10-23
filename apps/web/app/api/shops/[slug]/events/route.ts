import { eventStream } from "@krizaka/realtime/sse";
import { minutesToMilliseconds, secondsToMilliseconds } from "date-fns";

import { handle } from "@/lib/http";
import { realtimeBus, slotsTopic } from "@/lib/realtime";
import { appSettings } from "@/lib/settings";
import { loadPublicShop } from "@/lib/shop-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Concurrent streams per public shop page on this instance, shared across route bundles. */
const holder = globalThis as unknown as { __akinazaStorefrontStreams?: Map<string, number> };
const streams = holder.__akinazaStorefrontStreams ??= new Map<string, number>();

export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const settings = appSettings();
    if (!(await settings.get("realtime.storefront.enabled"))) return new Response(null, { status: 404 });
    const { slug } = await params;
    const page = await loadPublicShop(slug);
    if (!page) return new Response(null, { status: 404 });
    const [heartbeat, maxStreams] = await Promise.all([
      settings.get("realtime.storefront.heartbeatSeconds"),
      settings.get("realtime.storefront.maxStreamsPerPage"),
    ]);
    if (req.signal.aborted) return new Response(null, { status: 204 });
    const shopId = page.shop.id;
    const count = streams.get(shopId) ?? 0;
    if (count >= maxStreams) return new Response(null, { status: 429 });
    const bus = realtimeBus();
    streams.set(shopId, count + 1);
    return eventStream({
      heartbeatMs: secondsToMilliseconds(heartbeat),
      maxLifetimeMs: minutesToMilliseconds(5),
      retryMs: secondsToMilliseconds(2),
      headers: { "Cache-Control": "no-store, no-transform" },
      start: ({ send, close, signal }) => {
        let unsubscribe: (() => void) | undefined;
        let released = false;
        const cleanup = () => {
          if (released) return;
          released = true;
          req.signal.removeEventListener("abort", close);
          unsubscribe?.();
          const remaining = (streams.get(shopId) ?? 1) - 1;
          if (remaining) streams.set(shopId, remaining);
          else streams.delete(shopId);
        };
        signal.addEventListener("abort", cleanup, { once: true });
        req.signal.addEventListener("abort", close, { once: true });
        try {
          // Never forward the bus payload: only this shop's invalidation crosses the public wire.
          unsubscribe = bus.subscribe(slotsTopic(shopId), () => send({ event: "slots.changed", data: { type: "slots.changed" } }));
          if (req.signal.aborted) close();
        } catch (error) {
          cleanup();
          throw error;
        }
        return cleanup;
      },
    });
  });
}
