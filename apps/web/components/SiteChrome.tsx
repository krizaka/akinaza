"use client";

import { AkinazaLogo } from "@krizaka/ui";
import { publicBarLinks } from "@krizaka/ui/app-frame";
import { languagesFor } from "@krizaka/ui/language-switch";
import { NavBar } from "@krizaka/ui/nav-bar";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Locale } from "@/lib/i18n";
import { type PageId, pagePath, REPO_URL } from "@/lib/site";
import { PRODUCT_NAME } from "@/lib/brand";

export interface SiteBarLabels {
  nav: string;
  brandHome: string;
  sourceCode: string;
  theme: string;
  language: string;
  /** « Explorer »: the shops on a map (akinaza#235). */
  explore: string;
  menu: string;
  preferences: string;
}

/**
 * The bar of a Krizaka product (products independent): the animated mark · flat links (`publicBarLinks` of the family: Pricing,
 * Docs — Overview is the mark, the demo shop is in the footer and the home's action) · the repository, the theme,
 * the language, sign-in and the one action. No version chip (the version is in the footer), no family switcher, no link
 * to another product.
 *
 * The bar itself is a client island: it receives its words already said (the server composes them, so the catalogues never travel to the browser) and the session's two places as nodes. */
export function SiteBar({ locale, current, path, languages: offered, contentLocale, labels, sessionBar, sessionPanel }: Readonly<{ locale: Locale; current: PageId; path?: string; /** The languages the page is offered in (a shop page: the owner's list); default: the product's own. */ languages?: readonly string[]; /** The language of the page's content when it is not the product's (Spanish). */ contentLocale?: string; labels: SiteBarLabels; sessionBar: ReactNode; sessionPanel: ReactNode }>) {
  const t = (key: keyof SiteBarLabels) => labels[key];
  const languages = languagesFor(path ?? pagePath(locale, current), offered);
  const currentLanguage = contentLocale ?? locale;
  const home = pagePath(locale, "home");
  const family = publicBarLinks({ pricing: pagePath(locale, "pricing"), docs: pagePath(locale, "docs") }, locale).map((l) => ({ ...l, active: l.id === current || (l.id === "docs" && current.startsWith("docs/")) }));
  // « Explorer » first (the public side of the product: find a shop), then the family's links: three in all, under the bar's four.
  const items = [{ id: "explore", label: t("explore"), href: pagePath(locale, "explore"), active: current === "explore" }, ...family];
  return (
    <div className="pointer-events-none sticky top-0 z-50 h-0 px-3" data-site-bar>
      {/* 12 px under the development notice (or the top): an offset that takes no room in the flow, so nothing moves below it. */}
      <div className="relative top-3">
      <NavBar.Root label={t("nav")} className="pointer-events-auto mx-auto max-w-(--kz-page-max,72rem)">
        <NavBar.Brand asChild>
          <Link href={home} aria-label={t("brandHome")}>
            <AkinazaLogo size={26} />
            {PRODUCT_NAME}
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
          <NavBar.Repo href={REPO_URL} label={t("sourceCode")} className="hidden lg:inline-flex" />
          <span className="hidden md:inline-flex">
            <ThemeToggle label={t("theme")} variant="ghost" />
          </span>
          <span className="hidden md:inline-flex">
            <NavBar.Language label={t("language")} current={currentLanguage} languages={languages} linkAs={Link} />
          </span>
          {sessionBar}

          <NavBar.Mobile openLabel={t("menu")} closeLabel={t("menu")} className="max-h-[calc(100dvh-6rem)] gap-1 overflow-y-auto overscroll-contain p-3">
            {items.map((i) => (
              <NavBar.MobileLink key={i.id} asChild active={i.active}>
                <Link href={i.href}>{i.label}</Link>
              </NavBar.MobileLink>
            ))}
            <NavBar.MobilePreferences label={t("preferences")}>
              <ThemeToggle label={t("theme")} variant="ghost" />
              <NavBar.Language label={t("language")} current={currentLanguage} languages={languages} linkAs={Link} />
            </NavBar.MobilePreferences>
            {sessionPanel}
          </NavBar.Mobile>
        </NavBar.Actions>
      </NavBar.Root>
      </div>
    </div>
  );
}
