import { SlugHoldsView } from "@/components/admin/SlugHoldsView";
import { asLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Shop addresses: the held ones to review, the protected terms, the one-off re-judging (ADR-005 slice 4, akinaza#537). Data is read by the view through the query client. */
export default async function AdminAddresses({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const t = translator(asLocale((await params).locale));
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-xl font-bold text-fg">{t("console.admin.slugHolds.title")}</h1>
        <p className="m-0 max-w-[70ch] text-fg-secondary">{t("console.admin.slugHolds.lead")}</p>
      </header>
      <SlugHoldsView />
    </div>
  );
}
