import { AkinazaLogo } from "@krizaka/ui";

import { CodeNameChip } from "@/components/CodeNameChip";
import { endorsementIn, PRODUCT_NAME } from "@/lib/brand";
import { codeNameLine } from "@/lib/code-name";
import type { Locale } from "@/lib/i18n";

/**
 * The lockup (mark, commercial name, « by Krizaka »), drawn by the server with the same markup as `ProductLockup` of @krizaka/ui.
 * The library's `ProductLockup` picks the mark by id, so it carries every product's mark (and Kridoc's) into the browser bundle,
 * +2 KB on each shop page against a bar that draws this product's mark only. Until the library offers a lockup that takes its mark
 * (krizaka-ui), this one keeps the shop pages inside their JavaScript budget.
 */
export function BrandLockup({ locale, size = 26 }: Readonly<{ locale: Locale; size?: number }>) {
  const codeName = codeNameLine(locale);
  return (
    <span className="inline-flex items-center gap-2.5" data-brand="akinaza">
      <AkinazaLogo size={size} />
      <span className="flex flex-col leading-tight">
        <span className="flex items-baseline gap-1.5">
          <span className="text-base font-semibold tracking-tight text-fg">{PRODUCT_NAME}</span>
          <span className="text-xs text-fg-secondary">{endorsementIn(locale)}</span>
        </span>
        {/* Development only (lib/code-name.ts): the code name under the commercial name. */}
        {codeName ? <CodeNameChip>{codeName}</CodeNameChip> : null}
      </span>
    </span>
  );
}
