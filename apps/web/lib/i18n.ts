import { createI18n, type MessageKey as KeyOf } from "@krizaka/i18n";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { bindProduct } from "./brand";

/**
 * Every user-facing string lives in messages/<locale>.json — English is the reference, French a language of design
 * (the product is made in Montréal). fr.json type-checks against en.json; `krizaka-i18n check` (pnpm lint) checks the rest.
 */
export type Locale = "en" | "fr";
export type Messages = typeof en;
export type MessageKey = KeyOf<Messages>;

export const LOCALES: readonly Locale[] = ["en", "fr"];

/**
 * The languages a shop's public page can speak (#258). The product's own words (menus, buttons) exist in English and French only;
 * the shop's content can also be offered in Spanish, translated through Orazaka. A page in Spanish keeps the English product words.
 */
export type PageLocale = Locale | "es";
export const PAGE_LOCALES: readonly PageLocale[] = ["en", "fr", "es"];
export const asPageLocale = (raw: string): PageLocale => (raw === "es" ? "es" : asLocale(raw));
/** The language of the product's own words on a page in this content language. */
export const uiLocaleOf = (locale: PageLocale): Locale => (locale === "es" ? "en" : locale);

export const i18n = createI18n<Messages, Locale>({ en: bindProduct(en), fr: bindProduct(fr) }, { defaultLocale: "en" });
export const { getDictionary, asLocale } = i18n;
export const translator = (locale: Locale) => i18n.translator(locale);
export const otherLocale = (locale: Locale): Locale => LOCALES.find((l) => l !== locale) ?? "en";

export { format } from "@krizaka/i18n";
