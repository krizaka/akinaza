import { WORKSPACE_KINDS } from "@akinaza/db";

import { OrganizeConfig, type StoredKind } from "@/components/admin/OrganizeConfig";
import { asLocale, translator } from "@/lib/i18n";
import { workspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** The administrator's defaults of « the workspace, organised » (akinaza#337): tag sets by trade, who writes them, the invoice's states. */
export default async function AdminOrganize({ params }: { params: Promise<{ locale: string }> }) {
  const t = translator(asLocale((await params).locale));
  const stored: StoredKind[] = [];
  for (const kind of WORKSPACE_KINDS) {
    const row = await workspace("platform").config.get(kind);
    if (row) stored.push({ kind, config: row.config, version: row.version });
  }
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-fg">{t("console.admin.organize.title")}</h1>
        <p className="max-w-prose text-fg-secondary">{t("console.admin.organize.lead")}</p>
      </header>
      {stored.length ? stored.map((s) => <OrganizeConfig key={s.kind} stored={s} />) : <p className="text-fg-secondary">{t("console.admin.organize.none")}</p>}
    </div>
  );
}
