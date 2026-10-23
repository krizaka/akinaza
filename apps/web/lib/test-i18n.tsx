import type { BusinessType } from "@akinaza/core";
import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider, VocabularyProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;

/** Renders a client component of the signed-in space to static markup, in a language and a business type (for component tests). */
export const renderIn = (locale: "en" | "fr", type: BusinessType, node: React.ReactNode) =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <VocabularyProvider type={type}>{node}</VocabularyProvider>
      </KrizakaQueryProvider>
    </I18nProvider>,
  );
