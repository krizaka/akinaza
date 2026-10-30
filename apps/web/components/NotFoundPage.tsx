import { ErrorPage } from "@krizaka/ui/error-page";
import { Mascot } from "@krizaka/ui/mascots";
import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";

/** The 404 of every address, in the language of the address: the beaver, the code, one sentence, the way back to the bar's home. */
export function NotFoundPage({ locale }: Readonly<{ locale: Locale }>) {
  const t = getDictionary(locale).notFound;
  return (
    <ErrorPage
      code="404"
      mascot={<Mascot bird="beaver" mood="empty" size={120} />}
      title={t.title}
      text={t.text}
      actions={
        <Link href={`/${locale}`} className="font-semibold text-fg-accent underline">
          {t.home}
        </Link>
      }
    />
  );
}
