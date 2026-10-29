"use client";

import type { BusinessType } from "@akinaza/core";
import { vocabularyOf } from "@akinaza/core";
import { createI18nReact } from "@krizaka/i18n/react";
import { createContext, useCallback, useContext } from "react";

import type { Locale, Messages } from "./i18n";
import { overlayOf, type Tree, wordAt } from "./vocabulary";

/** The console's client side: it receives only the `console` slice of the active language. */
export type ConsoleMessages = Pick<Messages, "console">;

export const { I18nProvider, useI18n } = createI18nReact<ConsoleMessages, Locale>({ locales: ["en", "fr"], defaultLocale: "en" });

/** The business type whose words the screens below speak (krizaka/akinaza#117): the shop's, read on the server. */
const VocabularyContext = createContext<BusinessType>("pets");

/** The words of a shop's business type for everything below. The default, outside a shop, is the base (pet-care) wording of the first business Akinaza served. */
export function VocabularyProvider({ type, children }: Readonly<{ type: BusinessType; children: React.ReactNode }>) {
  return <VocabularyContext.Provider value={type}>{children}</VocabularyContext.Provider>;
}

/** What a business type changes beyond its words (a dog on the booking, a report on the visit). */
export function useVocabulary(explicit?: BusinessType) {
  const inherited = useContext(VocabularyContext);
  const type = explicit ?? inherited;
  return { type, ...vocabularyOf(type) };
}

/**
 * The console's translator for keys built at run time (`errors.${code}`), `{placeholders}` filled. Stable between renders.
 * It speaks the business type's words: `console.vocabularies.<type>.<key>` when the type has its own, the base message otherwise.
 */
export function useSay(explicit?: BusinessType) {
  const { t, locale, messages, format } = useI18n();
  const { type } = useVocabulary(explicit);
  const say = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const own = wordAt(overlayOf(messages.console as unknown as Tree, type), key);
      return own !== undefined ? format(own, vars) : (t as unknown as (k: string, v?: Record<string, string | number>) => string)(`console.${key}`, vars);
    },
    [t, messages, format, type],
  );
  return { say, locale };
}
