import type { BarWords } from "@/components/account/BarSession";
import { LazyBarSession } from "@/components/account/LazyBarSession";
import { SignedOutActions } from "@/components/account/SignedOutActions";
import { SiteBar } from "@/components/SiteChrome";
import { type Locale, translator } from "@/lib/i18n";
import type { PageId } from "@/lib/site";

/**
 * The public bar, composed on the server: it says every word here, so the catalogues stay out of the browser, and hands the client island (`SiteBar`)
 * its labels. A page that read the cookie and saw no session says `anonymous`: the bar is then the signed-out one with no script for the session at all
 * (the shop pages, ADR-004); any other page keeps the island, which asks `/api/me` once the page has loaded and keeps the page static.
 */
export function SiteHeader({ locale, current, path, languages, contentLocale, anonymous = false }: Readonly<{ locale: Locale; current: PageId; path?: string; /** The languages the page is offered in (a shop page: the owner's list); default: the product's own. */ languages?: readonly string[]; /** The language of the page's content when it is not the product's (Spanish). */ contentLocale?: string; /** The page saw no session cookie. */ anonymous?: boolean }>) {
  const t = translator(locale);
  const words: BarWords = { signIn: t("chrome.signIn"), tryIt: t("chrome.tryIt"), openApp: t("chrome.openApp"), account: t("chrome.account"), settings: t("chrome.settings"), language: t("chrome.languageLabel"), theme: t("chrome.themeToggle"), signOut: t("chrome.signOut") };
  const labels = { nav: t("chrome.navLabel"), brandHome: t("chrome.brandHome"), sourceCode: t("chrome.sourceCode"), theme: t("chrome.themeToggle"), language: t("chrome.languageLabel"), explore: t("chrome.explore"), menu: t("chrome.menu.label"), preferences: t("chrome.preferences") };
  const session = (placement: "bar" | "panel") =>
    anonymous ? <SignedOutActions locale={locale} placement={placement} signupOpen={false} signIn={words.signIn} tryIt={words.tryIt} /> : <LazyBarSession locale={locale} words={words} placement={placement} />;
  return <SiteBar locale={locale} current={current} {...(path ? { path } : {})} {...(languages ? { languages } : {})} {...(contentLocale ? { contentLocale } : {})} labels={labels} sessionBar={session("bar")} sessionPanel={session("panel")} />;
}
