import { DeviceFrame } from "@krizaka/ui/step-showcase";

import { getDictionary, type Locale } from "@/lib/i18n";
import { STOREFRONT, storefrontStill } from "@/lib/tour";

/**
 * The hero's product: the real public storefront of the demo shop on a phone — a still captured on dev.akinaza.com after its
 * redesign (see lib/tour.ts), never a drawing. Painted at once (the page's LCP, preloaded by the page), never revealed.
 */
export function HeroPhone({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.hero;
  return (
    <figure className="m-0 flex flex-col items-center gap-3 py-2">
      <DeviceFrame kind="phone" className="w-[15.5rem] max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- a hashed still on the media CDN, sized, loaded first (the LCP) */}
        <img src={storefrontStill()} alt={t.visualAlt} width={STOREFRONT.width} height={STOREFRONT.height} fetchPriority="high" decoding="async" className="block h-auto w-full" />
      </DeviceFrame>
      <figcaption className="max-w-[28ch] text-center font-mono text-xs text-fg-muted">{t.caption}</figcaption>
    </figure>
  );
}
