import { LEXICON } from "@akinaza/core";
import { Glossary } from "@krizaka/ui/glossary";

import { getDictionary, type Locale } from "@/lib/i18n";

/** The owner's lexique (#260): every word of the figures in plain language, the ones that need an accountant marked. */
export function LexiconSection({ locale }: Readonly<{ locale: Locale }>) {
  const t = getDictionary(locale).console;
  return (
    <section aria-label={t.lexicon.title} className="flex flex-col gap-2" data-testid="lexicon">
      <Glossary
        title={t.lexicon.title}
        terms={LEXICON.map(({ id, accountant }) => ({
          id,
          term: t.lexicon.terms[id].term,
          definition: accountant ? `${t.lexicon.terms[id].definition} ${t.lexicon.accountant}` : t.lexicon.terms[id].definition,
        }))}
      />
    </section>
  );
}
