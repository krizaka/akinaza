import { readStorageSettings } from "@krizaka/storage/settings";

import { StorageRegion } from "@/components/admin/StorageRegion";
import { asLocale, translator } from "@/lib/i18n";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Where the files are kept (akinaza#397): the provider and region the administrator saved, and the residency it means. */
export default async function AdminStorage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const t = translator(asLocale((await params).locale));
  const saved = await readStorageSettings((key) => appSettings().get(key) as Promise<string | number>);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{t("console.admin.storage.title")}</h1>
        <p className="max-w-prose text-fg-secondary">{t("console.admin.storage.lead")}</p>
      </header>
      <StorageRegion saved={{ provider: saved.provider, endpoint: saved.endpoint, region: saved.region, bucket: saved.bucket }} />
    </div>
  );
}
