import { DeviceFrame } from "@krizaka/ui/step-showcase";

import { HeroTake } from "@/components/home/HeroTake";
import { getDictionary, type Locale } from "@/lib/i18n";
import { HERO_TAKE, heroTake } from "@/lib/tour";

/**
 * The hero's product: the real journey on a phone — the storefront, a booking, the walker's day, the report, « Vos livres » —
 * one continuous take recorded on dev.akinaza.com (lib/tour.ts), a muted loop over its poster. The poster is painted at once
 * (the page's LCP, preloaded by the page), never revealed; under reduced motion it stays a still.
 */
export function HeroPhone({ locale }: Readonly<{ locale: Locale }>) {
  const t = getDictionary(locale).landing.hero;
  const take = heroTake(locale);
  return (
    <figure className="m-0 flex flex-col items-center gap-3 py-2">
      <DeviceFrame kind="phone" className="w-[15.5rem] max-w-full">
        <HeroTake poster={take.poster} webm={take.webm} mp4={take.mp4} alt={t.visualAlt} width={HERO_TAKE.width} height={HERO_TAKE.height} />
      </DeviceFrame>
      <figcaption className="max-w-[28ch] text-center font-mono text-xs text-fg-muted">{t.caption}</figcaption>
    </figure>
  );
}
