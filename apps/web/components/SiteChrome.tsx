"use client";

import { AkinazaLogo } from "@krizaka/ui";
import { publicBarLinks } from "@krizaka/ui/app-frame";
import { languagesFor } from "@krizaka/ui/language-switch";
import { NavBar } from "@krizaka/ui/nav-bar";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";

import { BarSession, type BarWords } from "@/components/account/BarSession";
import { type Locale, translator } from "@/lib/i18n";
import { type PageId, pagePath, REPO_URL } from "@/lib/site";

/**
 * The bar of a Krizaka product (products independent): the animated mark · flat links (`publicBarLinks` of the family: Pricing,
 * Docs — Overview is the mark, the demo shop is in the footer and the home's action) · the repository, the theme,
 * the language, sign-in and the one action. No version chip (the version is in the footer), no family switcher, no link
 * to another product.
 */
export function SiteHeader({ locale, current, path, languages: offered, contentLocale }: { locale: Locale; current: PageId; path?: string; /** The languages the page is offered in (a shop page: the owner's list); default: the product's own. */ languages?: readonly string[]; /** The language of the page's content when it is not the product's (Spanish). */ contentLocale?: string }) {
  const t = translator(locale);
  const languages = languagesFor(path ?? pagePath(locale, current), offered);
  const currentLanguage = contentLocale ?? locale;
  const home = pagePath(locale, "home");
  const words: BarWords = { signIn: t("chrome.signIn"), tryIt: t("chrome.tryIt"), openApp: t("chrome.openApp"), account: t("chrome.account"), settings: t("chrome.settings"), language: t("chrome.languageLabel"), theme: t("chrome.themeToggle"), signOut: t("chrome.signOut") };
  const items = publicBarLinks({ pricing: pagePath(locale, "pricing"), docs: pagePath(locale, "docs") }, locale).map((l) => ({ ...l, active: l.id === current || (l.id === "docs" && current.startsWith("docs/")) }));
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3">
      <NavBar.Root label={t("chrome.navLabel")} className="pointer-events-auto mx-auto max-w-(--kz-page-max,72rem)">
        <NavBar.Brand asChild>
          <Link href={home} aria-label={t("chrome.brandHome")}>
            <AkinazaLogo size={26} />
            Akinaza
          </Link>
        </NavBar.Brand>
        <NavBar.Items>
          {items.map((i) => (
            <NavBar.Link key={i.id} asChild active={i.active}>
              <Link href={i.href}>{i.label}</Link>
            </NavBar.Link>
          ))}
        </NavBar.Items>

        <NavBar.Actions className="gap-1">
          <NavBar.Repo href={REPO_URL} label={t("chrome.sourceCode")} className="hidden lg:inline-flex" />
          <span className="hidden md:inline-flex">
            <ThemeToggle label={t("chrome.themeToggle")} variant="ghost" />
          </span>
          <span className="hidden md:inline-flex">
            <NavBar.Language label={t("chrome.languageLabel")} current={currentLanguage} languages={languages} linkAs={Link} />
          </span>
          <BarSession locale={locale} words={words} placement="bar" />

          <NavBar.Mobile openLabel={t("chrome.menu.label")} closeLabel={t("chrome.menu.label")} className="max-h-[calc(100dvh-6rem)] gap-1 overflow-y-auto overscroll-contain p-3">
            {items.map((i) => (
              <NavBar.MobileLink key={i.id} asChild active={i.active}>
                <Link href={i.href}>{i.label}</Link>
              </NavBar.MobileLink>
            ))}
            <NavBar.MobilePreferences label={t("chrome.preferences")}>
              <ThemeToggle label={t("chrome.themeToggle")} variant="ghost" />
              <NavBar.Language label={t("chrome.languageLabel")} current={currentLanguage} languages={languages} linkAs={Link} />
            </NavBar.MobilePreferences>
            <BarSession locale={locale} words={words} placement="panel" />
          </NavBar.Mobile>
        </NavBar.Actions>
      </NavBar.Root>
    </div>
  );
}
