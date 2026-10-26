import { SiteFooter as FamilyFooter, SiteFooterColumn, SiteFooterLink } from "@krizaka/ui/site-footer";
import Link from "next/link";

import { productFooterLabels } from "@/lib/footer-labels";
import { format, getDictionary, type Locale, translator } from "@/lib/i18n";
import { indexable } from "@/lib/indexing";
import { DEMO_SHOP } from "@/lib/landing";
import { uiVersion } from "@/lib/platform";
import { APP_VERSION, contactHref, pagePath, REPO_URL } from "@/lib/site";

/**
 * The footer is @krizaka/ui's SiteFooter in product mode (`family={false}`): the product's pages, its source and contact,
 * the publisher line « A Krizaka product » (→ www.krizaka.com), DEV · the version, Montréal. On a deployment kept out of
 * search engines the invitation line ends the signature row — one footer, no strip under it.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <FamilyFooter
      current="akinaza"
      family={false}
      labels={productFooterLabels(locale)}
      aria-label={t("chrome.footerLabel")}
      env={indexable() ? undefined : "DEV"}
      data-testid="app-version"
      legal={
        <>
          <span>
            {format(getDictionary(locale).chrome.version, { version: APP_VERSION })}
            {uiVersion() ? ` · Krizaka UI ${uiVersion()}` : ""}
          </span>
          {indexable() ? null : <span data-testid="dev-notice">{t("chrome.devNotice")}</span>}
        </>
      }
    >
      <SiteFooterColumn title="Akinaza">
        <SiteFooterLink asChild>
          <Link href={`/${locale}/s/${DEMO_SHOP}`}>{t("chrome.menu.shop.title")}</Link>
        </SiteFooterLink>
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "pricing")}>{t("chrome.menu.pricing.title")}</Link>
        </SiteFooterLink>
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "privacy")}>{t("chrome.legal")}</Link>
        </SiteFooterLink>
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "terms")}>{t("chrome.terms")}</Link>
        </SiteFooterLink>
        <SiteFooterLink href={REPO_URL}>{t("chrome.sourceCode")}</SiteFooterLink>
        <SiteFooterLink href={contactHref("dev-akinaza-footer")}>{t("chrome.contact")}</SiteFooterLink>
      </SiteFooterColumn>
    </FamilyFooter>
  );
}
